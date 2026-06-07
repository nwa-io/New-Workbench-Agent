export interface Department {
    id: string;
    name: string;
    description: string;
    agents: string[];
    color?: string;
}
  
export interface Agent {
    id: string;
    name: string;
    department: string;
    description: string;
    filepath: string;
}