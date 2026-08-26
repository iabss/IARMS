import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Download, 
  Search, 
  Filter, 
  RotateCcw, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  ChevronRight, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Award, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { AFSFindingRecord, PublicAuditItem } from '../types';
import rawSheetData from '../data/sheetData.json';
import { getMergedSheetRows, getProjectLinkConfigs } from '../data/dataSyncManager';
import { isDepartment, parseDepartments } from '../utils/deptHelper';
import { isStatusClosed, isStatusOpen, isStatusProgress, extractFindingYear } from '../utils/statusHelper';

interface PublicPortalProps {
  publicAuditList?: PublicAuditItem[];
  onToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAFS?: (filter?: { dept?: string; search?: string; status?: string; project?: string }) => void;
  key?: string;
}

export interface ProjectSummary {
  groupKey: string;
  siteName: string;
  scopeAudit: string;
  year: string;
  projectName: string;
  totalItems: number;
  closedItems: number;
  openItems: number;
  progressItems: number;
  overdueItems: number;
  achClosingSite: number;
  achClosingHO: number;
  closingRate: number;
  majorCount: number;
  minorCount: number;
  improvementCount: number;
  sites: string[];
  picSites: string[];
  picHOs: string[];
  achievementStatus: 'SELESAI' | 'PROGRESS' | 'ATTENTION';
}

const GOOGLE_SHEET_URL = rawSheetData.sourceUrl || "https://docs.google.com/spreadsheets/d/1JSugcnXqujmxcyDhlF1IwIefDdtPxkRC/edit";

export default function PublicPortal({ onToast, onNavigateToAFS }: PublicPortalProps) {
  const [syncedVersion, setSyncedVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  React.useEffect(() => {
    const handleDataSynced = () => {
      setSyncedVersion(v => v + 1);
      setIsSyncing(false);
    };

    const handleSyncStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.isSyncing === 'boolean') {
        setIsSyncing(customEvent.detail.isSyncing);
      }
    };

    window.addEventListener('afs_data_synced', handleDataSynced);
    window.addEventListener('afs_sync_status_changed', handleSyncStatus);
    return () => {
      window.removeEventListener('afs_data_synced', handleDataSynced);
      window.removeEventListener('afs_sync_status_changed', handleSyncStatus);
    };
  }, []);

  const allRows = useMemo(() => {
    return getMergedSheetRows();
  }, [syncedVersion]);

  // Filter & Search Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('ALL');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('ALL');
  const [selectedKategoriFilter, setSelectedKategoriFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [groupByMode, setGroupByMode] = useState<'jobsite_scope' | 'project_only'>('jobsite_scope');
  const [sortBy, setSortBy] = useState<'closingRateDesc' | 'closingRateAsc' | 'totalItemsDesc' | 'projectNameAsc'>('closingRateDesc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Available Filter Options
  const configuredProjectConfigs = useMemo(() => {
    return getProjectLinkConfigs();
  }, [syncedVersion, isSyncing]);

  const configuredProjectSet = useMemo(() => {
    const set = new Set<string>();
    configuredProjectConfigs.forEach(c => {
      if (c.projectName) {
        set.add(c.projectName.trim().toUpperCase());
      }
    });
    return set;
  }, [configuredProjectConfigs]);

  const configuredProjectNames = useMemo(() => {
    const map = new Map<string, string>();
    configuredProjectConfigs.forEach(c => {
      if (c.projectName) {
        const name = c.projectName.trim();
        const key = name.toUpperCase();
        if (!map.has(key)) map.set(key, name);
      }
    });
    return Array.from(map.values()).sort();
  }, [configuredProjectConfigs]);

  const projectsList = useMemo(() => {
    const map = new Map<string, string>();
    if (configuredProjectConfigs.length > 0) {
      configuredProjectConfigs.forEach(c => {
        const proj = (c.projectName || '').trim();
        if (proj) {
          const key = proj.toUpperCase();
          if (!map.has(key)) map.set(key, proj);
        }
      });
    } else {
      allRows.forEach(r => {
        const proj = (r['PROJECT AUDIT'] || '').trim();
        if (proj) {
          const key = proj.toUpperCase();
          if (!map.has(key)) map.set(key, proj);
        }
      });
    }
    return Array.from(map.values()).sort();
  }, [allRows, configuredProjectConfigs]);

  const sitesList = useMemo(() => {
    const map = new Map<string, string>();
    if (configuredProjectConfigs.length > 0) {
      configuredProjectConfigs.forEach(c => {
        if (c.siteName) {
          const trimmed = c.siteName.trim();
          if (trimmed) {
            const key = trimmed.toUpperCase();
            if (!map.has(key)) map.set(key, trimmed);
          }
        }
      });
    } else {
      allRows.forEach(r => {
        if (r.SITE) {
          const trimmed = r.SITE.trim();
          if (trimmed) {
            const key = trimmed.toUpperCase();
            if (!map.has(key)) map.set(key, trimmed);
          }
        }
      });
    }
    return Array.from(map.values()).sort();
  }, [allRows, configuredProjectConfigs]);

  // Aggregation per Jobsite & Scope Audit or Scope Audit
  const projectSummaries = useMemo(() => {
    // 1. Primary path: When user has configured project links (e.g. 11 projects)
    if (configuredProjectConfigs && configuredProjectConfigs.length > 0) {
      const configItems: ProjectSummary[] = [];

      configuredProjectConfigs.forEach(cfg => {
        const projName = (cfg.projectName || '').trim();
        if (!projName) return;
        const siteName = (cfg.siteName || 'HEAD OFFICE').trim();
        const yearStr = cfg.year ? String(cfg.year).trim() : '2026';

        // Check project filter
        if (selectedProjectFilter !== 'ALL') {
          if (selectedProjectFilter === 'LINKED_ONLY') {
            if (!cfg.sheetUrl || cfg.sheetUrl.trim() === '') return;
          } else if (projName.toUpperCase() !== selectedProjectFilter.toUpperCase()) {
            return;
          }
        }

        // Check site filter
        if (selectedSiteFilter !== 'ALL' && siteName.toUpperCase() !== selectedSiteFilter.toUpperCase()) {
          return;
        }

        const tProj = projName.toUpperCase();
        const tSite = siteName.toUpperCase();
        const tYear = yearStr.trim();

        // Match rows specifically for this project config
        const matchingRows = allRows.filter(item => {
          const rowProj = (item["PROJECT AUDIT"] || '').trim().toUpperCase();
          const rowSite = (item.SITE || '').trim().toUpperCase();
          const rowYear = extractFindingYear(item, tYear);

          if (rowProj !== tProj) return false;
          if (tSite && tSite !== 'HEAD OFFICE' && tSite !== 'ALL') {
            if (rowSite !== tSite) return false;
          }
          if (tYear && rowYear && rowYear !== tYear) {
            return false;
          }

          // Apply category filter if active
          if (selectedKategoriFilter !== 'ALL') {
            const kat = (item.KATEGORI || '').toUpperCase();
            if (!kat.includes(selectedKategoriFilter.toUpperCase())) return false;
          }

          return true;
        });

        let total = matchingRows.length;
        let close = 0;
        let open = 0;
        let progress = 0;
        let overdue = 0;
        let major = 0;
        let minor = 0;
        let improvement = 0;
        let siteTotal = 0;
        let siteClose = 0;
        let hoTotal = 0;
        let hoClose = 0;
        const sites = new Set<string>();
        if (siteName) sites.add(siteName);
        const picSites = new Set<string>();
        const picHOs = new Set<string>();

        matchingRows.forEach(item => {
          const isItemClosed = isStatusClosed(item.STATUS, item.REMARKS, item["REVIEWED CLOSING FROM IA"]);
          const isItemOpen = isStatusOpen(item.STATUS, item.REMARKS, item["REVIEWED CLOSING FROM IA"]);

          const picSiteStr = (item["PIC SITE"] || '').trim();
          const picHOStr = (item["PIC HO"] || '').trim();

          if (isDepartment(picSiteStr)) {
            siteTotal += 1;
            if (isItemClosed) siteClose += 1;
          }

          if (isDepartment(picHOStr)) {
            hoTotal += 1;
            if (isItemClosed) hoClose += 1;
          }

          if (isItemClosed) {
            close += 1;
          } else if (isItemOpen) {
            open += 1;
          } else {
            progress += 1;
          }

          const remarks = (item.REMARKS || '').toUpperCase().trim();
          if (remarks.includes('OVERDUE')) {
            overdue += 1;
          }

          const kat = (item.KATEGORI || '').toUpperCase().trim();
          if (kat.includes('MAJOR')) major += 1;
          else if (kat.includes('MINOR')) minor += 1;
          else if (kat.includes('IMPROVEMENT')) improvement += 1;

          if (item.SITE && item.SITE.trim()) sites.add(item.SITE.trim());
          if (item["PIC SITE"] && item["PIC SITE"].trim()) {
            parseDepartments(item["PIC SITE"]).forEach(t => {
              if (t) picSites.add(t);
            });
          }
          if (item["PIC HO"] && item["PIC HO"].trim()) {
            parseDepartments(item["PIC HO"]).forEach(t => {
              if (t) picHOs.add(t);
            });
          }
        });

        // If no matching rows in dataset but rowCount was recorded during sheet sync
        if (total === 0 && cfg.rowCount && cfg.rowCount > 0 && selectedKategoriFilter === 'ALL') {
          total = cfg.rowCount;
        }

        const closingRate = total > 0 ? (close / total) * 100 : 0;
        const achClosingSite = siteTotal > 0 ? (siteClose / siteTotal) * 100 : closingRate;
        const achClosingHO = hoTotal > 0 ? (hoClose / hoTotal) * 100 : closingRate;
        let achievementStatus: 'SELESAI' | 'PROGRESS' | 'ATTENTION' = 'PROGRESS';
        if (total === 0) achievementStatus = 'PROGRESS';
        else if (closingRate >= 80) achievementStatus = 'SELESAI';
        else if (closingRate < 50) achievementStatus = 'ATTENTION';

        const groupKey = `${siteName.toUpperCase()}___${projName.toUpperCase()}___${yearStr.toUpperCase()}`;

        configItems.push({
          groupKey,
          siteName,
          scopeAudit: projName,
          year: yearStr,
          projectName: siteName && siteName !== 'HEAD OFFICE' ? `${siteName} - ${projName}` : projName,
          totalItems: total,
          closedItems: close,
          openItems: open,
          progressItems: progress,
          overdueItems: overdue,
          achClosingSite: parseFloat(achClosingSite.toFixed(2)),
          achClosingHO: parseFloat(achClosingHO.toFixed(2)),
          closingRate: parseFloat(closingRate.toFixed(2)),
          majorCount: major,
          minorCount: minor,
          improvementCount: improvement,
          sites: Array.from(sites),
          picSites: Array.from(picSites),
          picHOs: Array.from(picHOs),
          achievementStatus,
          siteTotal,
          siteClose,
          hoTotal,
          hoClose,
        } as any);
      });

      // If grouped by project only
      if (groupByMode === 'project_only') {
        const projMap = new Map<string, ProjectSummary & { siteTotal?: number; siteClose?: number; hoTotal?: number; hoClose?: number }>();
        configItems.forEach(item => {
          const key = `${item.scopeAudit.toUpperCase()}___${item.year.toUpperCase()}`;
          if (!projMap.has(key)) {
            projMap.set(key, {
              ...item,
              groupKey: key,
              siteName: item.siteName,
              projectName: item.scopeAudit,
              sites: [...item.sites],
              picSites: [...item.picSites],
              picHOs: [...item.picHOs],
              siteTotal: (item as any).siteTotal || 0,
              siteClose: (item as any).siteClose || 0,
              hoTotal: (item as any).hoTotal || 0,
              hoClose: (item as any).hoClose || 0,
            });
          } else {
            const existing = projMap.get(key)!;
            const combinedTotal = existing.totalItems + item.totalItems;
            const combinedClose = existing.closedItems + item.closedItems;
            const combinedOpen = existing.openItems + item.openItems;
            const combinedProgress = existing.progressItems + item.progressItems;
            const combinedOverdue = existing.overdueItems + item.overdueItems;
            const combinedRate = combinedTotal > 0 ? (combinedClose / combinedTotal) * 100 : 0;
            const combinedSites = Array.from(new Set([...existing.sites, ...item.sites]));
            
            const combinedSiteTotal = (existing.siteTotal || 0) + ((item as any).siteTotal || 0);
            const combinedSiteClose = (existing.siteClose || 0) + ((item as any).siteClose || 0);
            const combinedHoTotal = (existing.hoTotal || 0) + ((item as any).hoTotal || 0);
            const combinedHoClose = (existing.hoClose || 0) + ((item as any).hoClose || 0);

            const combinedAchSite = combinedSiteTotal > 0 ? (combinedSiteClose / combinedSiteTotal) * 100 : combinedRate;
            const combinedAchHO = combinedHoTotal > 0 ? (combinedHoClose / combinedHoTotal) * 100 : combinedRate;

            let st: 'SELESAI' | 'PROGRESS' | 'ATTENTION' = 'PROGRESS';
            if (combinedTotal === 0) st = 'PROGRESS';
            else if (combinedRate >= 80) st = 'SELESAI';
            else if (combinedRate < 50) st = 'ATTENTION';

            projMap.set(key, {
              ...existing,
              siteName: combinedSites.join(', '),
              totalItems: combinedTotal,
              closedItems: combinedClose,
              openItems: combinedOpen,
              progressItems: combinedProgress,
              overdueItems: combinedOverdue,
              achClosingSite: parseFloat(combinedAchSite.toFixed(2)),
              achClosingHO: parseFloat(combinedAchHO.toFixed(2)),
              closingRate: parseFloat(combinedRate.toFixed(2)),
              majorCount: existing.majorCount + item.majorCount,
              minorCount: existing.minorCount + item.minorCount,
              improvementCount: existing.improvementCount + item.improvementCount,
              sites: combinedSites,
              picSites: Array.from(new Set([...existing.picSites, ...item.picSites])),
              picHOs: Array.from(new Set([...existing.picHOs, ...item.picHOs])),
              achievementStatus: st,
              siteTotal: combinedSiteTotal,
              siteClose: combinedSiteClose,
              hoTotal: combinedHoTotal,
              hoClose: combinedHoClose,
            });
          }
        });
        return Array.from(projMap.values());
      }

      return configItems;
    }

    // 2. Fallback path: If no configured links exist, group dynamic rows from allRows
    const map = new Map<string, {
      siteName: string;
      scopeAudit: string;
      years: Set<string>;
      total: number;
      close: number;
      siteTotal: number;
      siteClose: number;
      hoTotal: number;
      hoClose: number;
      open: number;
      progress: number;
      overdue: number;
      major: number;
      minor: number;
      improvement: number;
      sites: Set<string>;
      picSites: Set<string>;
      picHOs: Set<string>;
    }>();

    allRows.forEach((item: AFSFindingRecord) => {
      if (selectedKategoriFilter !== 'ALL') {
        const kat = (item.KATEGORI || '').toUpperCase();
        if (!kat.includes(selectedKategoriFilter.toUpperCase())) return;
      }

      if (selectedProjectFilter !== 'ALL') {
        const proj = (item["PROJECT AUDIT"] || '').trim().toUpperCase();
        if (selectedProjectFilter !== 'LINKED_ONLY' && proj !== selectedProjectFilter.toUpperCase()) return;
      }

      if (selectedSiteFilter !== 'ALL' && (item.SITE || '').trim() !== selectedSiteFilter) return;

      const siteStr = (item.SITE || "HEAD OFFICE").trim();
      const scopeStr = (item["PROJECT AUDIT"] || "LAINNYA").trim();
      const rowYear = extractFindingYear(item, '2026');

      const key = groupByMode === 'jobsite_scope'
        ? `${siteStr.toUpperCase()}___${scopeStr.toUpperCase()}___${rowYear.toUpperCase()}`
        : `${scopeStr.toUpperCase()}___${rowYear.toUpperCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          siteName: siteStr,
          scopeAudit: scopeStr,
          years: new Set([rowYear]),
          total: 0,
          close: 0,
          siteTotal: 0,
          siteClose: 0,
          hoTotal: 0,
          hoClose: 0,
          open: 0,
          progress: 0,
          overdue: 0,
          major: 0,
          minor: 0,
          improvement: 0,
          sites: new Set([siteStr]),
          picSites: new Set(),
          picHOs: new Set(),
        });
      }

      const entry = map.get(key)!;
      entry.total += 1;

      const isItemClosed = isStatusClosed(item.STATUS, item.REMARKS, item["REVIEWED CLOSING FROM IA"]);
      const isItemOpen = isStatusOpen(item.STATUS, item.REMARKS, item["REVIEWED CLOSING FROM IA"]);

      const picSiteStr = (item["PIC SITE"] || '').trim();
      const picHOStr = (item["PIC HO"] || '').trim();

      if (isDepartment(picSiteStr)) {
        entry.siteTotal += 1;
        if (isItemClosed) entry.siteClose += 1;
      }

      if (isDepartment(picHOStr)) {
        entry.hoTotal += 1;
        if (isItemClosed) entry.hoClose += 1;
      }

      if (isItemClosed) entry.close += 1;
      else if (isItemOpen) entry.open += 1;
      else entry.progress += 1;

      const remarks = (item.REMARKS || '').toUpperCase().trim();
      if (remarks.includes('OVERDUE')) entry.overdue += 1;

      const kat = (item.KATEGORI || '').toUpperCase().trim();
      if (kat.includes('MAJOR')) entry.major += 1;
      else if (kat.includes('MINOR')) entry.minor += 1;
      else if (kat.includes('IMPROVEMENT')) entry.improvement += 1;

      if (item.SITE && item.SITE.trim()) entry.sites.add(item.SITE.trim());
      if (item["PIC SITE"] && item["PIC SITE"].trim()) {
        parseDepartments(item["PIC SITE"]).forEach(t => {
          if (t) entry.picSites.add(t);
        });
      }
      if (item["PIC HO"] && item["PIC HO"].trim()) {
        parseDepartments(item["PIC HO"]).forEach(t => {
          if (t) entry.picHOs.add(t);
        });
      }
    });

    const list: ProjectSummary[] = [];
    map.forEach((val, key) => {
      const closingRate = val.total > 0 ? (val.close / val.total) * 100 : 0;
      const achClosingSite = val.siteTotal > 0 ? (val.siteClose / val.siteTotal) * 100 : closingRate;
      const achClosingHO = val.hoTotal > 0 ? (val.hoClose / val.hoTotal) * 100 : closingRate;
      let achievementStatus: 'SELESAI' | 'PROGRESS' | 'ATTENTION' = 'PROGRESS';
      if (val.total === 0) achievementStatus = 'PROGRESS';
      else if (closingRate >= 80) achievementStatus = 'SELESAI';
      else if (closingRate < 50) achievementStatus = 'ATTENTION';

      const uniqueSitesList = Array.from(new Set(Array.from(val.sites).map(s => s.trim())));
      const displaySite = groupByMode === 'jobsite_scope' ? val.siteName : (uniqueSitesList.length > 0 ? uniqueSitesList.join(', ') : val.siteName);
      const yearsArr = Array.from(val.years).filter(Boolean);
      const displayYear = yearsArr.length > 0 ? yearsArr.join(', ') : '2026';

      list.push({
        groupKey: key,
        siteName: displaySite,
        scopeAudit: val.scopeAudit,
        year: displayYear,
        projectName: `${displaySite} - ${val.scopeAudit}`,
        totalItems: val.total,
        closedItems: val.close,
        openItems: val.open,
        progressItems: val.progress,
        overdueItems: val.overdue,
        achClosingSite: parseFloat(achClosingSite.toFixed(2)),
        achClosingHO: parseFloat(achClosingHO.toFixed(2)),
        closingRate: parseFloat(closingRate.toFixed(2)),
        majorCount: val.major,
        minorCount: val.minor,
        improvementCount: val.improvement,
        sites: Array.from(val.sites),
        picSites: Array.from(val.picSites),
        picHOs: Array.from(val.picHOs),
        achievementStatus,
      });
    });

    return list;
  }, [allRows, selectedProjectFilter, selectedSiteFilter, selectedKategoriFilter, groupByMode, configuredProjectConfigs]);

  // Overall Dataset Global Metrics calculated from projectSummaries to guarantee exact sync
  const globalMetrics = useMemo(() => {
    let total = 0;
    let close = 0;
    let open = 0;
    let progress = 0;
    let overdue = 0;

    projectSummaries.forEach(p => {
      total += p.totalItems;
      close += p.closedItems;
      open += p.openItems;
      progress += p.progressItems;
      overdue += p.overdueItems;
    });

    const closePct = total > 0 ? ((close / total) * 100).toFixed(2) : '0.00';
    const openPct = total > 0 ? ((open / total) * 100).toFixed(2) : '0.00';
    const progressPct = total > 0 ? ((progress / total) * 100).toFixed(2) : '0.00';
    const overduePct = total > 0 ? ((overdue / total) * 100).toFixed(2) : '0.00';

    return { total, close, open, progress, overdue, closePct, openPct, progressPct, overduePct };
  }, [projectSummaries]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    let result = projectSummaries.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.projectName.toLowerCase().includes(q) ||
        p.siteName.toLowerCase().includes(q) ||
        p.scopeAudit.toLowerCase().includes(q) ||
        p.sites.some(s => s.toLowerCase().includes(q)) ||
        p.picSites.some(pic => pic.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'SELESAI' && p.achievementStatus !== 'SELESAI') return false;
        if (selectedStatusFilter === 'PROGRESS' && p.achievementStatus !== 'PROGRESS') return false;
        if (selectedStatusFilter === 'ATTENTION' && p.achievementStatus !== 'ATTENTION') return false;
      }

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === 'closingRateDesc') return b.closingRate - a.closingRate;
      if (sortBy === 'closingRateAsc') return a.closingRate - b.closingRate;
      if (sortBy === 'totalItemsDesc') return b.totalItems - a.totalItems;
      if (sortBy === 'projectNameAsc') return a.projectName.localeCompare(b.projectName);
      return 0;
    });
  }, [projectSummaries, searchQuery, selectedStatusFilter, sortBy]);

  // Active Metrics considering filters (Average Achievement Closing Rate across Projects: Rata-rata Achievement seluruh project)
  const activeMetrics = useMemo(() => {
    const hasActiveFilters = searchQuery.trim() !== '' || selectedProjectFilter !== 'ALL' || selectedSiteFilter !== 'ALL' || selectedKategoriFilter !== 'ALL' || selectedStatusFilter !== 'ALL';
    
    const targetProjects = hasActiveFilters ? filteredProjects : projectSummaries;
    const total = targetProjects.reduce((acc, p) => acc + p.totalItems, 0);
    const close = targetProjects.reduce((acc, p) => acc + p.closedItems, 0);
    const open = targetProjects.reduce((acc, p) => acc + p.openItems, 0);
    const progress = targetProjects.reduce((acc, p) => acc + p.progressItems, 0);
    const overdue = targetProjects.reduce((acc, p) => acc + p.overdueItems, 0);

    // Hitung rata-rata (average) achievement closing rate dari seluruh project yang ada
    const validProjects = targetProjects.filter(p => p.totalItems > 0);
    const avgCloseRate = validProjects.length > 0
      ? validProjects.reduce((acc, p) => acc + p.closingRate, 0) / validProjects.length
      : 0;

    const avgOpenRate = validProjects.length > 0
      ? validProjects.reduce((acc, p) => acc + (p.totalItems > 0 ? (p.openItems / p.totalItems) * 100 : 0), 0) / validProjects.length
      : 0;

    const avgProgressRate = validProjects.length > 0
      ? validProjects.reduce((acc, p) => acc + (p.totalItems > 0 ? (p.progressItems / p.totalItems) * 100 : 0), 0) / validProjects.length
      : 0;

    const avgOverdueRate = validProjects.length > 0
      ? validProjects.reduce((acc, p) => acc + (p.totalItems > 0 ? (p.overdueItems / p.totalItems) * 100 : 0), 0) / validProjects.length
      : 0;

    const closePct = avgCloseRate.toFixed(2).replace('.', ',');
    const openPct = avgOpenRate.toFixed(2).replace('.', ',');
    const progressPct = avgProgressRate.toFixed(2).replace('.', ',');
    const overduePct = avgOverdueRate.toFixed(2).replace('.', ',');

    return { total, close, open, progress, overdue, closePct, openPct, progressPct, overduePct };
  }, [projectSummaries, filteredProjects, searchQuery, selectedProjectFilter, selectedSiteFilter, selectedKategoriFilter, selectedStatusFilter]);

  // Average Achievement Closing Rate (Unweighted Average across Projects)
  const avgAchievementClosing = useMemo(() => {
    const targetProjects = filteredProjects.length > 0 ? filteredProjects : projectSummaries;
    if (targetProjects.length === 0) return '0,00';
    
    const validProjects = targetProjects.filter(p => p.totalItems > 0);
    if (validProjects.length === 0) return '0,00';
    
    const sumRates = validProjects.reduce((acc, p) => acc + p.closingRate, 0);
    const avg = sumRates / validProjects.length;
    return avg.toFixed(2).replace('.', ',');
  }, [filteredProjects, projectSummaries]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProjectFilter('ALL');
    setSelectedSiteFilter('ALL');
    setSelectedKategoriFilter('ALL');
    setSelectedStatusFilter('ALL');
    setSortBy('closingRateDesc');
    onToast('Filter pencapaian berhasil direset', 'info');
  };

  // Export Aggregated Summary to CSV
  const handleExportSummaryCSV = () => {
    if (filteredProjects.length === 0) {
      onToast('Tidak ada data resume project untuk diexport', 'warning');
      return;
    }

    const headers = [
      'No',
      'Nama Project Audit',
      'Coverage Site',
      'Total Temuan',
      'Temuan Close',
      'Closing Rate (%)',
      'Temuan Open',
      'On Progress',
      'Overdue Remarks',
      'Major',
      'Minor',
      'Improvement',
      'Status Achievement'
    ];

    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      const strVal = String(val).replace(/\r\n|\n|\r/g, ' ').replace(/"/g, '""');
      return `"${strVal}"`;
    };

    const rows = filteredProjects.map((p, index) => [
      escapeCell(index + 1),
      escapeCell(p.projectName),
      escapeCell(p.sites.join(', ')),
      escapeCell(p.totalItems),
      escapeCell(p.closedItems),
      escapeCell(`${p.closingRate}%`),
      escapeCell(p.openItems),
      escapeCell(p.progressItems),
      escapeCell(p.overdueItems),
      escapeCell(p.majorCount),
      escapeCell(p.minorCount),
      escapeCell(p.improvementCount),
      escapeCell(p.achievementStatus)
    ]);

    const delimiter = ';';
    const csvContent = [
      `sep=${delimiter}`,
      headers.map(h => escapeCell(h)).join(delimiter),
      ...rows.map(r => r.join(delimiter))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Resume_Pencapaian_Audit_Per_Project_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onToast(`Berhasil mengexport resume statistik ${filteredProjects.length} project!`, 'success');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 rounded-2xl text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-full relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              DASHBOARD RISK BASED AUDIT (AUDIT OPERASIONAL)
            </h1>
            <div className="shrink-0">
              {isSyncing ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 text-xs font-extrabold transition-all shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  <span>syncr<span className="text-yellow-400 font-black">o</span>nizing</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold transition-all">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  syncronized
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Overall AFS KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Total Rekomendasi
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {activeMetrics.total.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200/80 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Temuan Close
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {activeMetrics.closePct}%
          </span>
        </div>

        <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200/80 shadow-sm transition-all hover:border-rose-300 hover:shadow-md">
          <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Temuan Open
          </span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">
            {activeMetrics.openPct}%
          </span>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200/80 shadow-sm transition-all hover:border-amber-300 hover:shadow-md">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> On Progress
          </span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">
            {activeMetrics.progressPct}%
          </span>
        </div>

        <div className="bg-purple-50/80 p-4 rounded-xl border border-purple-200/80 shadow-sm col-span-2 md:col-span-1 transition-all hover:border-purple-300 hover:shadow-md">
          <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider block flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-purple-600" /> Overdue Remarks
          </span>
          <span className="text-2xl font-black text-purple-700 mt-1 block">
            {activeMetrics.overduePct}%
          </span>
        </div>
      </div>



      {/* Main Content Area: Grid View vs Table View */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Info className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Tidak Ada Audit yang Sesuai Filter</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian, filter site, atau klik tombol reset filter untuk melihat seluruh data.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl transition-all inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          {filteredProjects.map((project, idx) => {
            const isHigh = project.closingRate >= 80;
            const isLow = project.closingRate < 50;

            let badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            let badgeText = 'Selesai / On-Track';
            let progressColor = 'bg-emerald-500';

            if (isLow) {
              badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';
              badgeText = 'Perlu Perhatian';
              progressColor = 'bg-rose-500';
            } else if (!isHigh) {
              badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
              badgeText = 'Dalam Progress';
              progressColor = 'bg-amber-500';
            }

            return (
              <motion.div
                key={`pub-card-${project.groupKey || 'group'}-${idx}`}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Card Top Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-3 py-1 rounded-lg bg-sky-900 text-white font-mono font-extrabold text-xs tracking-wider shadow-sm">
                      {project.siteName}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeBg}`}>
                      {badgeText}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                      {project.scopeAudit}
                    </h3>
                  </div>
                </div>

                {/* Closing Rate Gauge / Progress */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">Achievement Closing Rate</span>
                    <span className={`text-xl font-black ${
                      isHigh ? 'text-emerald-600' : isLow ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {project.closingRate.toFixed(2)}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${progressColor} transition-all duration-500 rounded-full`} 
                      style={{ width: `${project.closingRate}%` }} 
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>Closed: <strong className="text-emerald-700 font-bold">{project.closedItems}</strong></span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const filterKey = project.scopeAudit || project.siteName;
                        onNavigateToAFS?.({ search: filterKey, status: 'OPEN' });
                        onToast(`Mengarahkan ke Resume AFS (${filterKey} - OPEN)...`, 'info');
                      }}
                      className="hover:text-rose-900 cursor-pointer transition-colors"
                      title="Klik untuk membuka rekomendasi OPEN di Resume AFS"
                    >
                      <span>Open: <strong className="text-rose-700 font-bold underline decoration-dotted hover:decoration-solid">{project.openItems}</strong></span>
                    </button>
                    <span>Total: <strong className="text-slate-800 font-bold">{project.totalItems}</strong></span>
                  </div>
                </div>

                {/* Category & Status Metric Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                    <span className="text-[10px] text-rose-600 font-bold uppercase block">Major</span>
                    <span className="text-sm font-extrabold text-rose-800">{project.majorCount}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <span className="text-[10px] text-amber-600 font-bold uppercase block">Minor</span>
                    <span className="text-sm font-extrabold text-amber-800">{project.minorCount}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-sky-50 border border-sky-100">
                    <span className="text-[10px] text-sky-600 font-bold uppercase block">Improvement</span>
                    <span className="text-sm font-extrabold text-sky-800">{project.improvementCount}</span>
                  </div>
                </div>

                {/* Overdue Warning pill if applicable */}
                {project.overdueItems > 0 && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-[11px] font-semibold border border-purple-200">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-purple-600" /> Overdue Remarks:
                    </span>
                    <span className="font-bold">{project.overdueItems} Items</span>
                  </div>
                )}

                {/* Action Link */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    PIC: {project.picSites.slice(0, 2).join(', ') || '-'}
                  </span>

                  {onNavigateToAFS && (
                    <button
                      onClick={onNavigateToAFS}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline inline-flex items-center gap-1"
                    >
                      Detail Temuan <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Summary Table Mode */
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[520px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <table className="w-full text-xs text-left border-collapse relative">
              <thead className="sticky top-0 z-20 bg-[#1e293b] shadow-sm">
                <tr className="bg-[#1e293b] text-white uppercase tracking-wider font-bold text-[11px] border-b border-slate-700">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-700 sticky top-0 bg-[#1e293b]">NO</th>
                  <th className="py-3 px-4 min-w-[120px] font-extrabold border-r border-slate-700 sticky top-0 bg-[#1e293b]">JOBSITE</th>
                  <th className="py-3 px-4 min-w-[220px] font-extrabold border-r border-slate-700 sticky top-0 bg-[#1e293b]">SCOPE AUDIT</th>
                  <th className="py-3 px-3 min-w-[90px] text-center font-extrabold border-r border-slate-700 sticky top-0 bg-[#1e293b]">TAHUN</th>
                  <th className="py-3 px-3 text-center border-r border-slate-700 sticky top-0 bg-[#1e293b]">TOTAL REKOMENDASI</th>
                  <th className="py-3 px-3 text-center border-r border-slate-700 sticky top-0 bg-[#1e293b]">REKOMENDASI OPEN</th>
                  <th className="py-3 px-3 text-center border-r border-slate-700 sticky top-0 bg-[#1e293b]">REKOMENDASI CLOSE</th>
                  <th className="py-3 px-3 text-center border-r border-slate-700 font-black text-amber-300 min-w-[125px] sticky top-0 bg-[#1e293b]">ACH CLOSING (SITE)</th>
                  <th className="py-3 px-3 text-center border-r border-slate-700 font-black text-purple-300 min-w-[125px] sticky top-0 bg-[#1e293b]">ACH CLOSING (HO)</th>
                  <th className="py-3 px-4 min-w-[160px] text-center sticky top-0 bg-[#1e293b]">CLOSING RATE (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProjects.map((proj, idx) => {
                  const isHigh = proj.closingRate >= 80;
                  const isLow = proj.closingRate < 50;

                  return (
                    <tr key={`pub-row-${proj.groupKey || 'group'}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                        {idx + 1}.
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900 border-r border-slate-200 uppercase tracking-wide">
                        <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-900 border border-slate-300 font-extrabold inline-block">
                          {proj.siteName}
                        </span>
                      </td>

                      <td className="py-3 px-4 border-r border-slate-200">
                        <span className="font-bold text-slate-900 block uppercase">{proj.scopeAudit}</span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-800 border-r border-slate-200 text-xs">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-extrabold inline-block">
                          {proj.year}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-extrabold text-slate-900 border-r border-slate-200 text-sm">
                        {proj.totalItems}
                      </td>

                      <td 
                        className="py-3 px-3 text-center font-extrabold text-rose-700 bg-rose-50/70 hover:bg-rose-100 border-r border-slate-200 text-sm cursor-pointer transition-colors group/open"
                        title={`Klik untuk melihat temuan OPEN ${proj.scopeAudit || proj.siteName} di Resume AFS`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const filterKey = proj.scopeAudit || proj.siteName;
                          onNavigateToAFS?.({ search: filterKey, status: 'OPEN' });
                          onToast(`Mengarahkan ke Resume AFS (${filterKey} - OPEN)...`, 'info');
                        }}
                      >
                        <span className="underline decoration-dotted group-hover/open:decoration-solid group-hover/open:font-black transition-all">{proj.openItems}</span>
                      </td>

                      <td className="py-3 px-3 text-center font-extrabold text-emerald-700 border-r border-slate-200 text-sm">
                        {proj.closedItems}
                      </td>

                      <td 
                        className="py-3 px-3 text-center font-extrabold text-slate-900 border-r border-slate-200 bg-amber-300/80 cursor-help"
                        title="Dihitung dari rekomendasi yang ditujukan kepada PIC Site"
                      >
                        {proj.achClosingSite.toFixed(2)}%
                      </td>

                      <td 
                        className="py-3 px-3 text-center font-extrabold text-slate-900 border-r border-slate-200 bg-purple-300/80 cursor-help"
                        title="Dihitung dari rekomendasi yang ditujukan kepada PIC HO"
                      >
                        {proj.achClosingHO.toFixed(2)}%
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${isHigh ? 'bg-emerald-500' : isLow ? 'bg-rose-500' : 'bg-amber-500'}`} 
                              style={{ width: `${proj.closingRate}%` }} 
                            />
                          </div>
                          <span className={`font-black text-xs min-w-[45px] text-right ${
                            isHigh ? 'text-emerald-700' : isLow ? 'text-rose-700' : 'text-amber-700'
                          }`}>
                            {proj.closingRate.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
