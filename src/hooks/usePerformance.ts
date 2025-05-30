/**
 * Hook para monitoramento de performance
 * 
 * Este hook fornece ferramentas para medir e monitorar a performance
 * da aplicação, incluindo métricas de renderização, API e recursos.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { PerformanceConfig, PerformanceState, PerformanceReport } from './types';

/**
 * Métrica de performance
 */
interface PerformanceMetric {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  category: 'render' | 'api' | 'user' | 'system' | 'custom';
  metadata?: Record<string, any>;
  tags?: string[];
}

/**
 * Configuração padrão
 */
const DEFAULT_CONFIG: PerformanceConfig = {
  enableMetrics: true,
  enableReporting: true,
  reportInterval: 30000, // 30 segundos
  maxMetrics: 1000,
  thresholds: {
    render: 16, // 60fps
    api: 1000, // 1 segundo
    user: 100, // 100ms para interações
  },
};

/**
 * Hook de performance
 */
export function usePerformance(config: Partial<PerformanceConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<PerformanceState>({
    isMonitoring: false,
    metrics: [],
    reports: [],
    currentReport: null,
    lastReportTime: null,
  });

  const metricsRef = useRef<PerformanceMetric[]>([]);
  const reportIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<PerformanceObserver | null>(null);
  const metricCounterRef = useRef(0);

  /**
   * Atualiza estado de forma segura
   */
  const updateState = useCallback((updates: Partial<PerformanceState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Gera ID único para métrica
   */
  const generateMetricId = useCallback(() => {
    return `metric_${++metricCounterRef.current}_${Date.now()}`;
  }, []);

  /**
   * Adiciona métrica
   */
  const addMetric = useCallback((metric: PerformanceMetric) => {
    if (!finalConfig.enableMetrics) return;

    metricsRef.current.push(metric);
    
    // Remove métricas antigas se exceder o limite
    if (metricsRef.current.length > finalConfig.maxMetrics) {
      metricsRef.current = metricsRef.current.slice(-finalConfig.maxMetrics);
    }

    updateState({ metrics: [...metricsRef.current] });

    // Log se exceder threshold
    const threshold = finalConfig.thresholds?.[metric.category];
    if (threshold && metric.duration && metric.duration > threshold) {
      logger.warn('Métrica de performance excedeu threshold', {
        component: 'usePerformance',
        action: 'addMetric',
        metricId: metric.id,
        category: metric.category,
        duration: metric.duration,
        threshold,
      });
    }
  }, [finalConfig.enableMetrics, finalConfig.maxMetrics, finalConfig.thresholds, updateState]);

  /**
   * Inicia medição de performance
   */
  const startMeasure = useCallback((name: string, category: PerformanceMetric['category'] = 'custom', metadata?: Record<string, any>) => {
    if (!finalConfig.enableMetrics) return null;

    const id = generateMetricId();
    const startTime = performance.now();

    const metric: PerformanceMetric = {
      id,
      name,
      startTime,
      category,
      metadata,
    };

    logger.debug('Iniciando medição de performance', {
      component: 'usePerformance',
      action: 'startMeasure',
      metricId: id,
      name,
      category,
    });

    return {
      id,
      end: (additionalMetadata?: Record<string, any>) => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        const completedMetric: PerformanceMetric = {
          ...metric,
          endTime,
          duration,
          metadata: { ...metadata, ...additionalMetadata },
        };

        addMetric(completedMetric);

        logger.debug('Medição de performance concluída', {
          component: 'usePerformance',
          action: 'endMeasure',
          metricId: id,
          duration,
          category,
        });

        return completedMetric;
      },
    };
  }, [finalConfig.enableMetrics, generateMetricId, addMetric]);

  /**
   * Mede função com performance
   */
  const measureFunction = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    category: PerformanceMetric['category'] = 'custom'
  ): T => {
    return ((...args: Parameters<T>) => {
      const measure = startMeasure(name, category, { args: args.length });
      
      try {
        const result = fn(...args);
        
        // Se é uma Promise, aguarda conclusão
        if (result instanceof Promise) {
          return result
            .then(value => {
              measure?.end({ success: true, resultType: 'promise' });
              return value;
            })
            .catch(error => {
              measure?.end({ success: false, error: error.message, resultType: 'promise' });
              throw error;
            });
        }
        
        measure?.end({ success: true, resultType: 'sync' });
        return result;
      } catch (error) {
        measure?.end({ success: false, error: (error as Error).message, resultType: 'sync' });
        throw error;
      }
    }) as T;
  }, [startMeasure]);

  /**
   * Mede componente React
   */
  const measureComponent = useCallback((componentName: string) => {
    return {
      onRenderStart: () => startMeasure(`${componentName}_render`, 'render'),
      onRenderEnd: (measure: ReturnType<typeof startMeasure>) => {
        measure?.end();
      },
    };
  }, [startMeasure]);

  /**
   * Mede chamada de API
   */
  const measureApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> => {
    const measure = startMeasure(`API_${method}_${endpoint}`, 'api', {
      endpoint,
      method,
    });

    try {
      const result = await apiCall();
      measure?.end({ success: true, status: 'success' });
      return result;
    } catch (error) {
      measure?.end({ 
        success: false, 
        status: 'error',
        error: (error as Error).message,
      });
      throw error;
    }
  }, [startMeasure]);

  /**
   * Mede interação do usuário
   */
  const measureUserInteraction = useCallback((action: string, target?: string) => {
    const measure = startMeasure(`User_${action}`, 'user', {
      action,
      target,
      timestamp: Date.now(),
    });

    return {
      end: (result?: 'success' | 'cancel' | 'error', metadata?: Record<string, any>) => {
        measure?.end({ result, ...metadata });
      },
    };
  }, [startMeasure]);

  /**
   * Gera relatório de performance
   */
  const generateReport = useCallback((): PerformanceReport => {
    const now = Date.now();
    const metrics = metricsRef.current;
    
    // Agrupa métricas por categoria
    const metricsByCategory = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    // Calcula estatísticas por categoria
    const categoryStats = Object.entries(metricsByCategory).reduce((acc, [category, categoryMetrics]) => {
      const durations = categoryMetrics
        .filter(m => m.duration !== undefined)
        .map(m => m.duration!);
      
      if (durations.length > 0) {
        durations.sort((a, b) => a - b);
        
        acc[category] = {
          count: durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
          median: durations[Math.floor(durations.length / 2)],
          p95: durations[Math.floor(durations.length * 0.95)],
          p99: durations[Math.floor(durations.length * 0.99)],
        };
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Identifica métricas problemáticas
    const slowMetrics = metrics.filter(metric => {
      const threshold = finalConfig.thresholds?.[metric.category];
      return threshold && metric.duration && metric.duration > threshold;
    });

    // Calcula métricas de navegação se disponíveis
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintTiming = performance.getEntriesByType('paint');
    
    const webVitals = {
      // First Contentful Paint
      fcp: paintTiming.find(entry => entry.name === 'first-contentful-paint')?.startTime,
      // Largest Contentful Paint (aproximado)
      lcp: paintTiming.find(entry => entry.name === 'largest-contentful-paint')?.startTime,
      // Time to Interactive (aproximado)
      tti: navigationTiming ? navigationTiming.domInteractive - navigationTiming.navigationStart : undefined,
      // Total Blocking Time (aproximado)
      tbt: slowMetrics.filter(m => m.category === 'render').reduce((sum, m) => sum + (m.duration || 0), 0),
    };

    const report: PerformanceReport = {
      id: `report_${now}`,
      timestamp: now,
      period: {
        start: metrics.length > 0 ? Math.min(...metrics.map(m => m.startTime)) : now,
        end: now,
      },
      summary: {
        totalMetrics: metrics.length,
        categoryCounts: Object.entries(metricsByCategory).reduce((acc, [cat, mets]) => {
          acc[cat] = mets.length;
          return acc;
        }, {} as Record<string, number>),
        slowMetricsCount: slowMetrics.length,
        avgDuration: metrics.length > 0 
          ? metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length 
          : 0,
      },
      categoryStats,
      slowMetrics: slowMetrics.slice(0, 10), // Top 10 métricas lentas
      webVitals,
      recommendations: generateRecommendations(categoryStats, slowMetrics, webVitals),
    };

    logger.info('Relatório de performance gerado', {
      component: 'usePerformance',
      action: 'generateReport',
      reportId: report.id,
      totalMetrics: report.summary.totalMetrics,
      slowMetricsCount: report.summary.slowMetricsCount,
    });

    return report;
  }, [finalConfig.thresholds]);

  /**
   * Gera recomendações baseadas nas métricas
   */
  const generateRecommendations = useCallback((
    categoryStats: Record<string, any>,
    slowMetrics: PerformanceMetric[],
    webVitals: any
  ): string[] => {
    const recommendations: string[] = [];

    // Recomendações para renderização
    if (categoryStats.render && categoryStats.render.avg > 16) {
      recommendations.push('Considere otimizar componentes React para melhorar a performance de renderização');
    }

    // Recomendações para API
    if (categoryStats.api && categoryStats.api.avg > 1000) {
      recommendations.push('APIs estão lentas. Considere implementar cache ou otimizar consultas');
    }

    // Recomendações para interações
    if (categoryStats.user && categoryStats.user.avg > 100) {
      recommendations.push('Interações do usuário estão lentas. Considere debounce ou otimizações de UI');
    }

    // Recomendações para Web Vitals
    if (webVitals.fcp && webVitals.fcp > 1800) {
      recommendations.push('First Contentful Paint está lento. Otimize o carregamento inicial');
    }

    if (webVitals.lcp && webVitals.lcp > 2500) {
      recommendations.push('Largest Contentful Paint está lento. Otimize recursos críticos');
    }

    if (webVitals.tbt > 300) {
      recommendations.push('Total Blocking Time alto. Reduza JavaScript que bloqueia a thread principal');
    }

    // Recomendações baseadas em métricas lentas
    const apiSlowCount = slowMetrics.filter(m => m.category === 'api').length;
    if (apiSlowCount > 5) {
      recommendations.push('Muitas chamadas de API lentas detectadas. Revise endpoints e implementações');
    }

    const renderSlowCount = slowMetrics.filter(m => m.category === 'render').length;
    if (renderSlowCount > 10) {
      recommendations.push('Muitas renderizações lentas. Considere React.memo, useMemo e useCallback');
    }

    return recommendations;
  }, []);

  /**
   * Inicia monitoramento automático
   */
  const startMonitoring = useCallback(() => {
    if (state.isMonitoring) return;

    updateState({ isMonitoring: true });

    // Configura relatórios automáticos
    if (finalConfig.enableReporting && finalConfig.reportInterval) {
      reportIntervalRef.current = setInterval(() => {
        const report = generateReport();
        updateState({
          reports: [...state.reports, report].slice(-10), // Mantém apenas os 10 últimos
          currentReport: report,
          lastReportTime: Date.now(),
        });
      }, finalConfig.reportInterval);
    }

    // Configura Performance Observer para métricas nativas
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        observerRef.current = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
              const metric: PerformanceMetric = {
                id: generateMetricId(),
                name: entry.name,
                startTime: entry.startTime,
                endTime: entry.startTime + entry.duration,
                duration: entry.duration,
                category: 'system',
                metadata: {
                  entryType: entry.entryType,
                  native: true,
                },
              };
              addMetric(metric);
            }
          });
        });

        observerRef.current.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      } catch (error) {
        logger.warn('Não foi possível configurar PerformanceObserver', {
          component: 'usePerformance',
          action: 'startMonitoring',
          error: (error as Error).message,
        });
      }
    }

    logger.info('Monitoramento de performance iniciado', {
      component: 'usePerformance',
      action: 'startMonitoring',
      enableReporting: finalConfig.enableReporting,
      reportInterval: finalConfig.reportInterval,
    });
  }, [state.isMonitoring, state.reports, finalConfig.enableReporting, finalConfig.reportInterval, generateReport, generateMetricId, addMetric, updateState]);

  /**
   * Para monitoramento
   */
  const stopMonitoring = useCallback(() => {
    if (!state.isMonitoring) return;

    updateState({ isMonitoring: false });

    // Limpa interval de relatórios
    if (reportIntervalRef.current) {
      clearInterval(reportIntervalRef.current);
      reportIntervalRef.current = null;
    }

    // Desconecta observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    logger.info('Monitoramento de performance parado', {
      component: 'usePerformance',
      action: 'stopMonitoring',
    });
  }, [state.isMonitoring, updateState]);

  /**
   * Limpa métricas
   */
  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
    updateState({ 
      metrics: [],
      reports: [],
      currentReport: null,
    });

    logger.info('Métricas de performance limpas', {
      component: 'usePerformance',
      action: 'clearMetrics',
    });
  }, [updateState]);

  /**
   * Exporta métricas
   */
  const exportMetrics = useCallback((format: 'json' | 'csv' = 'json') => {
    const report = generateReport();
    
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }
    
    if (format === 'csv') {
      const headers = ['id', 'name', 'category', 'duration', 'startTime', 'endTime'];
      const rows = metricsRef.current.map(metric => [
        metric.id,
        metric.name,
        metric.category,
        metric.duration || '',
        metric.startTime,
        metric.endTime || '',
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return '';
  }, [generateReport]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    // Estado
    ...state,
    config: finalConfig,
    
    // Medição
    startMeasure,
    measureFunction,
    measureComponent,
    measureApiCall,
    measureUserInteraction,
    
    // Relatórios
    generateReport,
    
    // Controle
    startMonitoring,
    stopMonitoring,
    clearMetrics,
    exportMetrics,
    
    // Utilitários
    getMetricsByCategory: (category: PerformanceMetric['category']) => 
      metricsRef.current.filter(m => m.category === category),
    getSlowMetrics: (threshold?: number) => 
      metricsRef.current.filter(m => {
        const categoryThreshold = threshold || finalConfig.thresholds?.[m.category];
        return categoryThreshold && m.duration && m.duration > categoryThreshold;
      }),
    getAverageDuration: (category?: PerformanceMetric['category']) => {
      const metrics = category 
        ? metricsRef.current.filter(m => m.category === category)
        : metricsRef.current;
      
      const durations = metrics.filter(m => m.duration).map(m => m.duration!);
      return durations.length > 0 
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
        : 0;
    },
    getMetricCount: (category?: PerformanceMetric['category']) => 
      category 
        ? metricsRef.current.filter(m => m.category === category).length
        : metricsRef.current.length,
  };
}