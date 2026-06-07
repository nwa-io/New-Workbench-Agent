import { execFile } from 'child_process';
import { mkdir } from 'fs/promises';
import { createRequire } from 'module';
import { promisify } from 'util';
import type { BrowserContext, Page } from 'playwright';
import { logger } from '@nwa/task-kernel';
import type { TaskJiraTicket } from '@nwa/workflow-sdk';

const execFileAsync = promisify(execFile);

const INSTALL_MAX_BUFFER = 100 * 1024 * 1024;
const JIRA_PAGE_TIMEOUT_MS = 60000;
const JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS = 12;
const JIRA_EMPTY_CONTENT_RETRY_DELAY_MS = 10000;
const JIRA_EMPTY_CONTENT_ERROR = 'No Jira title, description, or comments were found on the current page.';

/**
 * Self-contained Jira collection strategy: owns the Playwright browser lifecycle,
 * page scraping, issue-key resolution, and markdown formatting. Holds its own
 * browser/page state and depends only on the workflow SDK types and the shared
 * kernel logger — never on the core extension. Change how Jira is collected here
 * without touching core.
 */
export class JiraScraper {
  private browserContext?: BrowserContext;
  private page?: Page;

  parseLink(link: string): string {
    const trimmedLink = link.trim();

    if (!trimmedLink) {
      throw new Error('Paste a Jira ticket URL before running Collect Jira.');
    }

    let url: URL;
    try {
      url = new URL(trimmedLink);
    } catch {
      throw new Error('Paste a valid Jira ticket URL.');
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Paste a valid Jira ticket URL.');
    }

    return url.toString();
  }

  /** Open (or reuse) the persistent Chrome profile and navigate to the link. */
  async open(profilePath: string, link: string): Promise<void> {
    await mkdir(profilePath, { recursive: true });

    const context = await this.getOrCreateBrowserContext(profilePath);
    const page = await this.getOrCreatePage(context);

    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: JIRA_PAGE_TIMEOUT_MS });
    await page.bringToFront().catch(() => undefined);
    this.page = page;
  }

  /** Open the link, fail if still on the login page, and scrape the ticket. */
  async read(profilePath: string, link: string): Promise<TaskJiraTicket> {
    await this.open(profilePath, link);
    const page = this.page;
    if (!page) {
      throw new Error('Jira page was not opened.');
    }

    await page.waitForLoadState('domcontentloaded', { timeout: JIRA_PAGE_TIMEOUT_MS }).catch(() => undefined);
    await page.waitForTimeout(1200);

    if (this.isLoginPage(page.url())) {
      throw new Error('Jira is still on the login page. Log in in Chrome, then click RUN again.');
    }

    return this.extractTicketWithRetry(page, link);
  }

  async close(): Promise<void> {
    const context = this.browserContext;
    this.browserContext = undefined;
    this.page = undefined;

    if (!context) {
      return;
    }

    try {
      await Promise.all(context.pages().map(async page => {
        if (!page.isClosed()) {
          await page.close({ runBeforeUnload: false });
        }
      }));
      await context.close();
    } catch (error) {
      const message = (error as Error).message;
      if (this.isPlaywrightAlreadyClosedError(message)) {
        return;
      }

      logger.error('Unable to close Playwright Chrome after Jira read', error as Error);
      throw new Error(`Read Jira ticket, but unable to close Playwright Chrome: ${message}`);
    }
  }

  private async getOrCreateBrowserContext(profilePath: string): Promise<BrowserContext> {
    if (this.browserContext) {
      return this.browserContext;
    }

    const playwright = await this.loadPlaywright();
    const launchOptions = {
      channel: 'chrome',
      headless: false,
      viewport: null,
      args: ['--start-maximized']
    };

    try {
      this.browserContext = await playwright.chromium.launchPersistentContext(profilePath, launchOptions);
    } catch (error) {
      if (!this.shouldInstallPlaywrightChrome(error as Error)) {
        throw this.getBrowserLaunchError(error as Error);
      }

      await this.installPlaywrightChrome();
      this.browserContext = await playwright.chromium.launchPersistentContext(profilePath, launchOptions);
    }

    this.browserContext.on('close', () => {
      this.browserContext = undefined;
      this.page = undefined;
    });

    return this.browserContext;
  }

  private async getOrCreatePage(context: BrowserContext): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    const pages = context.pages().filter(page => !page.isClosed());
    this.page = pages[0] || await context.newPage();
    return this.page;
  }

  private isPlaywrightAlreadyClosedError(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('has been closed') ||
      normalizedMessage.includes('target page, context or browser has been closed') ||
      normalizedMessage.includes('browser has been closed');
  }

  private async loadPlaywright(): Promise<typeof import('playwright')> {
    try {
      return await import('playwright');
    } catch (error) {
      logger.error('Playwright dependency is missing', error as Error);
      throw new Error('Playwright is not installed. Run npm install, then try Jira again.');
    }
  }

  private shouldInstallPlaywrightChrome(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('executable doesn') ||
      message.includes('please run') ||
      message.includes('install chrome') ||
      message.includes('chromium distribution') ||
      message.includes('not found');
  }

  private async installPlaywrightChrome(): Promise<void> {
    let cliPath: string;

    try {
      const requireFunc = createRequire(__filename);
      cliPath = requireFunc.resolve('playwright/cli');
    } catch (error) {
      logger.error('Unable to find Playwright CLI', error as Error);
      throw new Error('Playwright CLI was not found. Run npm install, then try Jira again.');
    }

    try {
      logger.info('Installing Playwright Chrome for Jira integration');
      await execFileAsync(process.execPath, [cliPath, 'install', 'chrome'], {
        windowsHide: true,
        maxBuffer: INSTALL_MAX_BUFFER
      });
    } catch (error) {
      logger.error('Unable to install Playwright Chrome', error as Error);
      throw new Error(
        `Unable to install Playwright Chrome. Run npx playwright install chrome, then try again. ${this.getExecErrorText(error as Error)}`
      );
    }
  }

  private getBrowserLaunchError(error: Error): Error {
    logger.error('Unable to launch Playwright Chrome for Jira', error);
    return new Error(`Unable to open Playwright Chrome for Jira. ${error.message}`);
  }

  private async extractTicketWithRetry(page: Page, requestedLink: string): Promise<TaskJiraTicket> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS; attempt++) {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: JIRA_PAGE_TIMEOUT_MS }).catch(() => undefined);
        return await this.extractTicket(page, requestedLink);
      } catch (error) {
        lastError = error as Error;

        if (!this.isEmptyContentError(lastError) || attempt >= JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS) {
          throw lastError;
        }

        logger.debug(
          `Jira ticket content was not ready; retrying in ${JIRA_EMPTY_CONTENT_RETRY_DELAY_MS / 1000}s ` +
          `(${attempt}/${JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS})`
        );
        await page.waitForTimeout(JIRA_EMPTY_CONTENT_RETRY_DELAY_MS);
      }
    }

    throw lastError || new Error(JIRA_EMPTY_CONTENT_ERROR);
  }

  private isEmptyContentError(error: Error): boolean {
    return error.message === JIRA_EMPTY_CONTENT_ERROR;
  }

  private async extractTicket(page: Page, requestedLink: string): Promise<TaskJiraTicket> {
    const data = await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as { document: any; window: any };
      const document = browserGlobal.document;
      const window = browserGlobal.window;
      const normalize = (value: string | undefined | null): string => String(value || '')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

      const uniqueTexts = (values: string[]): string[] => {
        const seen = new Set<string>();
        const result: string[] = [];

        for (const value of values) {
          const text = normalize(value);
          const key = text.toLowerCase();

          if (text && !seen.has(key)) {
            seen.add(key);
            result.push(text);
          }
        }

        return result;
      };

      const getElements = (selectors: string[]): any[] => {
        const elements: any[] = [];

        for (const selector of selectors) {
          try {
            elements.push(...Array.from(document.querySelectorAll(selector)));
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return elements;
      };

      const getCleanText = (element: any): string => {
        if (!element) {
          return '';
        }

        const clone = element.cloneNode(true);
        const removableSelectors = [
          'script',
          'style',
          'svg',
          'button',
          'input',
          'textarea',
          'select',
          '[role="button"]',
          '[aria-hidden="true"]',
          '[data-testid*="actions"]',
          '[data-test-id*="actions"]',
          '[data-testid*="toolbar"]',
          '[data-test-id*="toolbar"]'
        ];

        for (const selector of removableSelectors) {
          try {
            for (const node of Array.from(clone.querySelectorAll(selector)) as any[]) {
              node.remove();
            }
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return normalize(clone.textContent || '');
      };

      const getText = (selectors: string[]): string => {
        for (const element of getElements(selectors)) {
          const text = getCleanText(element);

          if (text) {
            return text;
          }
        }

        return '';
      };

      const stripLeadingLabel = (value: string, label: string): string => {
        const text = normalize(value);
        const lowerText = text.toLowerCase();
        const lowerLabel = label.toLowerCase();

        if (lowerText === lowerLabel) {
          return '';
        }

        if (lowerText.startsWith(`${lowerLabel}\n`) || lowerText.startsWith(`${lowerLabel}:`)) {
          return normalize(text.slice(label.length).replace(/^[:\s]+/, ''));
        }

        return text;
      };

      const getFirstDescendantText = (element: any, selectors: string[]): string => {
        for (const selector of selectors) {
          try {
            const child = element.querySelector(selector);
            const text = getCleanText(child);

            if (text) {
              return text;
            }
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return '';
      };

      const getCommentTexts = (): string[] => {
        const commentBodySelectors = [
          '[data-testid*="comment.body"]',
          '[data-test-id*="comment.body"]',
          '[data-testid*="comment-content"]',
          '[data-test-id*="comment-content"]',
          '.ak-renderer-document',
          '.action-body',
          '.comment-body',
          '.wiki-content',
          '.user-content-block'
        ];
        const rawComments = getElements([
          '[data-testid="issue.activity.comment"]',
          '[data-test-id="issue.activity.comment"]',
          '[data-testid*="activity.comment"]',
          '[data-test-id*="activity.comment"]',
          '[data-testid^="issue-comment"]',
          '[data-test-id^="issue-comment"]',
          '[data-testid*="comment-container"]',
          '[data-test-id*="comment-container"]',
          '#commentmodule .activity-comment',
          '#commentmodule [id^="comment-"]',
          '#issue_actions_container .activity-comment',
          '.issue-data-block.activity-comment',
          '.activity-comment'
        ]).map((element) => {
          return getFirstDescendantText(element, commentBodySelectors) || getCleanText(element);
        });
        const ignoredText = new Set([
          'add a comment',
          'add a comment...',
          'comment',
          'comments'
        ]);

        return uniqueTexts(rawComments).filter((comment) => !ignoredText.has(comment.toLowerCase()));
      };

      const key = getText([
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-test-id="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-testid*="current-issue"]',
        '[data-test-id*="current-issue"]',
        'a[href*="/browse/"]',
        '#key-val'
      ]);
      const summary = getText([
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
        '[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
        '[data-testid*="summary.heading"]',
        '[data-test-id*="summary.heading"]',
        '#summary-val',
        'header h1',
        'h1'
      ]);
      const rawDescription = stripLeadingLabel(getText([
        '[data-testid="issue.views.field.rich-text.description"]',
        '[data-test-id="issue.views.field.rich-text.description"]',
        '[data-testid*="rich-text.description"]',
        '[data-test-id*="rich-text.description"]',
        '[data-testid*="description.field-inline-edit"]',
        '[data-test-id*="description.field-inline-edit"]',
        '[data-testid*="description"] .ak-renderer-document',
        '[data-test-id*="description"] .ak-renderer-document',
        '[data-field-id="description"]',
        '[aria-label="Description"]',
        '#description-val',
        '#descriptionmodule .user-content-block',
        '.description .user-content-block'
      ]), 'Description');
      const ignoredDescriptionText = new Set([
        'add a description',
        'add a description...',
        'no description'
      ]);
      const description = ignoredDescriptionText.has(rawDescription.toLowerCase()) ? '' : rawDescription;
      const comments = getCommentTexts();

      return {
        url: window.location.href,
        title: normalize(document.title),
        key,
        summary,
        description,
        comments
      };
    });
    const summary = data.summary.trim();
    const description = data.description.trim();
    const comments = data.comments
      .map((comment: string) => comment.trim())
      .filter(Boolean);

    if (!summary && !description && comments.length === 0) {
      throw new Error(JIRA_EMPTY_CONTENT_ERROR);
    }

    const key = this.normalizeIssueKey(data.key) ||
      this.getIssueKeyFromUrl(data.url) ||
      this.getIssueKeyFromUrl(requestedLink) ||
      this.getIssueKeyFromText([summary, description, comments.join('\n')].join('\n'));
    const title = summary || data.title.trim() || key || data.url;
    const content = this.formatTicketContent(title, description, comments);

    return {
      url: data.url,
      title,
      key,
      description: description || undefined,
      comments,
      content,
      lastReadAt: new Date().toISOString()
    };
  }

  private formatTicketContent(title: string, description: string, comments: string[]): string {
    return [
      `# Jira: ${title.trim()}`,
      '',
      '## Description',
      description.trim() || 'No description collected.',
      '',
      '## Comments',
      this.formatCommentMarkdown(comments, 3)
    ].join('\n').trim();
  }

  private formatCommentMarkdown(comments: string[], headingLevel: number): string {
    const normalizedComments = comments
      .map(comment => comment.trim())
      .filter(Boolean);

    if (normalizedComments.length === 0) {
      return 'No comments collected.';
    }

    const heading = '#'.repeat(headingLevel);
    return normalizedComments
      .map((comment, index) => [`${heading} Comment ${index + 1}`, comment].join('\n'))
      .join('\n\n');
  }

  private isLoginPage(urlValue: string): boolean {
    try {
      const url = new URL(urlValue);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();

      return hostname === 'id.atlassian.com' ||
        hostname.endsWith('.id.atlassian.com') ||
        pathname.includes('/login') ||
        pathname.includes('/secure/login');
    } catch {
      return false;
    }
  }

  private normalizeIssueKey(value: string): string | undefined {
    const match = value.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
    return match ? match[1].toUpperCase() : undefined;
  }

  private getIssueKeyFromUrl(value: string): string | undefined {
    try {
      const url = new URL(value);
      const browseMatch = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
      const selectedIssue = url.searchParams.get('selectedIssue');

      return this.normalizeIssueKey(browseMatch?.[1] || selectedIssue || '');
    } catch {
      return undefined;
    }
  }

  private getIssueKeyFromText(value: string): string | undefined {
    return this.normalizeIssueKey(value);
  }

  private getExecErrorText(error: Error): string {
    const execError = error as Error & {
      stderr?: string | Buffer;
      stdout?: string | Buffer;
    };
    const detail = execError.stderr?.toString().trim() ||
      execError.stdout?.toString().trim() ||
      execError.message;

    return detail.replace(/\s+/g, ' ').slice(0, 500);
  }
}
