export interface Project {
  name: string;
  path: string;
}

export interface Group {
  name: string;
  projects: Project[];
}

export interface Config {
  scanDirs?: string[];
  scanMarker?: string;
  scanMaxDepth?: number;
}

export interface Cache {
  groups: Group[];
}
