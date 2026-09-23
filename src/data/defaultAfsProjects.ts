import { ProjectLinkConfig } from './dataSyncManager';

/**
 * 11 Default AFS Projects from Development Environment
 * Used as fallback and seeded to Cloudflare KV / Server Master Database
 * if KV storage is empty.
 */
export const DEFAULT_DEV_AFS_PROJECTS: ProjectLinkConfig[] = [
  {
    id: "PR-PAYMENT|JKT|2026",
    projectName: "PR-PAYMENT",
    siteName: "JKT",
    year: "2026",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1266648135#gid=1266648135",
    rowCount: 90,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:00.522Z",
    defaultProject: "PR-PAYMENT",
    project: "PR-PAYMENT",
    site: "JKT"
  },
  {
    id: "AUDIT OPERASIONAL IT|JKT|2026",
    projectName: "AUDIT OPERASIONAL IT",
    siteName: "JKT",
    year: "2026",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1641654012#gid=1641654012",
    rowCount: 107,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:02.263Z",
    defaultProject: "AUDIT OPERASIONAL IT",
    project: "AUDIT OPERASIONAL IT",
    site: "JKT"
  },
  {
    id: "CLOSING PROJECT|MAS|2026",
    projectName: "CLOSING PROJECT",
    siteName: "MAS",
    year: "2026",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1389087209#gid=1389087209",
    rowCount: 31,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:06.995Z",
    defaultProject: "CLOSING PROJECT",
    project: "CLOSING PROJECT",
    site: "MAS"
  },
  {
    id: "CLOSING PROJECT|AGM|2026",
    projectName: "CLOSING PROJECT",
    siteName: "AGM",
    year: "2026",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1539166529#gid=1539166529",
    rowCount: 43,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:10.481Z",
    defaultProject: "CLOSING PROJECT",
    project: "CLOSING PROJECT",
    site: "AGM"
  },
  {
    id: "AUDIT OPERASIONAL|IP BAYAN|2026",
    projectName: "AUDIT OPERASIONAL",
    siteName: "IP BAYAN",
    year: "2026",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1494177098#gid=1494177098",
    rowCount: 166,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:16.696Z",
    defaultProject: "AUDIT OPERASIONAL",
    project: "AUDIT OPERASIONAL",
    site: "IP BAYAN"
  },
  {
    id: "AUDIT OPERASIONAL|CDI|2025",
    projectName: "AUDIT OPERASIONAL",
    siteName: "CDI",
    year: "2025",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1980857748#gid=1980857748",
    rowCount: 144,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:21.636Z",
    defaultProject: "AUDIT OPERASIONAL",
    project: "AUDIT OPERASIONAL",
    site: "CDI"
  },
  {
    id: "AUDIT OPERASIONAL|MBL|2025",
    projectName: "AUDIT OPERASIONAL",
    siteName: "MBL",
    year: "2025",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=914111570#gid=914111570",
    rowCount: 121,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:25.156Z",
    defaultProject: "AUDIT OPERASIONAL",
    project: "AUDIT OPERASIONAL",
    site: "MBL"
  },
  {
    id: "AUDIT OPERASIONAL|MME|2025",
    projectName: "AUDIT OPERASIONAL",
    siteName: "MME",
    year: "2025",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1203180077#gid=1203180077",
    rowCount: 95,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:28.082Z",
    defaultProject: "AUDIT OPERASIONAL",
    project: "AUDIT OPERASIONAL",
    site: "MME"
  },
  {
    id: "AUDIT INVESTIGASI|AGM|2025",
    projectName: "AUDIT INVESTIGASI",
    siteName: "AGM",
    year: "2025",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=858614751#gid=858614751",
    rowCount: 21,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:33.301Z",
    defaultProject: "AUDIT INVESTIGASI",
    project: "AUDIT INVESTIGASI",
    site: "AGM"
  },
  {
    id: "AUDIT OPERASIONAL|MAS|2025",
    projectName: "AUDIT OPERASIONAL",
    siteName: "MAS",
    year: "2025",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=279759483#gid=279759483",
    rowCount: 110,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:36:33.883Z",
    defaultProject: "AUDIT OPERASIONAL",
    project: "AUDIT OPERASIONAL",
    site: "MAS"
  },
  {
    id: "AUDIT OPERASIONAL IT|JKT|2025",
    projectName: "AUDIT OPERASIONAL IT",
    siteName: "JKT",
    year: "2025",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit?gid=1433562805#gid=1433562805",
    rowCount: 115,
    status: "synced",
    lastSyncedAt: "2026-09-23T09:34:02.369Z",
    defaultProject: "AUDIT OPERASIONAL IT",
    project: "AUDIT OPERASIONAL IT",
    site: "JKT"
  }
];
