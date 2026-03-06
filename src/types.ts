export interface Project {
  name: string;
  path: string;
}

export interface Group {
  name: string;
  projects: Project[];
}

export interface Config {
  groups: Group[];
  scanDirs?: string[];
  scanMarker?: string;
  scanMaxDepth?: number;
}
