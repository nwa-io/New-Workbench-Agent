# SpeX Design Specs

**Export Mode**: Shared Instance References

## File Structure

- `component_set.yaml` - Contains design specs for component sets for different variants of the component
- `/components/` - Contains instance components organized by name (instances are deduplicated and shared)
- `/styles/` - Contains styles organized by category (fills, strokes, effects, typography)
- `/icons/` - Contains SVG icon exports
- `/images/` - Contains PNG/JPEG image exports. Commonly used for background images.
- `/previews/` - Contains PNG previews of design components
- `<ui_pattern_name>.md` - *(optional)* UI Pattern description when a pattern is mapped to this export
- `/manifest.yaml` - Lists all files in the export

## Component Structure

YAML files contain detailed component specifications including:

- `type`: Component type (FRAME, TEXT, etc.)
- `componentProperties`: Properties specific to the component
- `autoLayout`: Figma Auto Layout properties that indicate the alignment of the component (horizontal, vertical) and the spacing between components
- `styleRefs`: Style references used by the component
- `overrides`: Custom property overrides for instances
- `codeFilePath`: Path to the associated code implementation file
- `codeComponent`: Name of the code component for development reference

## Reference System

### Style References
Style references use the following format:

```
@styles/[category]#[style-id]
```

### Component References (Shared Mode)
Instance components are referenced using:

```
@components/[component-name]#[component-id]
```

In shared mode, multiple instances of the same component reference a single shared definition. For example:
- `@components/button#button-123` - All button instances reference this shared definition
- The shared definition contains the complete component structure and properties
- Instance references include only overrides specific to each usage

## Instance Organization (Shared Mode)

### Deduplication Strategy
- Instances with the same ID are deduplicated
- Only one definition is stored per unique component
- Multiple references can point to the same definition
- Saves space and maintains consistency

### Example Structure
```
/components/
  button.yaml          # Contains shared button definitions
  input-field.yaml     # Contains shared input field definitions
```

### Reference Example
```yaml
# In screen.yaml
children:
  - id: button-123
    type: INSTANCE_REF
    instanceRef: '@components/button#button-123'
    overrides:
      - property: text
        value: "Click Me"
  - id: button-124  
    type: INSTANCE_REF
    instanceRef: '@components/button#button-123'  # Same shared definition
    overrides:
      - property: text
        value: "Submit"
```

## Notes

- Instance components are deduplicated and stored in shared definition files
- Main screens reference these shared definitions
- Instance references (type: INSTANCE_REF) include only overrides
- Multiple instances can reference the same shared definition

## Fine Tuning Metadata

Components can include code implementation metadata:
- `codeFilePath`: Specifies the path to the implementation file
- `codeComponent`: Identifies the component name in code

This metadata facilitates direct mapping between design and code.

## MCP Integration

This export is compatible with the Model Context Protocol (MCP) for real-time serving to AI development tools. The specification files can be served on-demand using standardized MCP tools:

- `get-specs-readme`: Fetch this README documentation
- `get-spec-files-manifest`: Get complete file catalog
- `get-a-spec-file`: Request specific component specifications
- `get-page-thumbnail`: Fetch design thumbnails

All tool names are managed through centralized constants for consistency across the development workflow.

## Design Previews

Preview images are available in the `/previews/` directory. These PNG exports provide a visual reference for each component and screen in the design system.

## UI Pattern Reference

When a UI Pattern is mapped to the export, the root component YAML includes a `ui_pattern` field pointing to a markdown file that describes the pattern the design follows. This helps developers understand which established pattern the screen or component implements.

## Notes

- Instance components are organized in the components folder and referenced from main screens
- Main screens are in the root directory
- Instance components in the hierarchy are replaced with references (type: INSTANCE_REF)
- Icons are exported as SVG files in the icons folder
- Design previews help developers visualize components during implementation
- When mapped, the `ui_pattern` field in root YAML references a `<name>.md` file with the pattern description
