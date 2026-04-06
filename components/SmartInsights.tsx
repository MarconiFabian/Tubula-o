
import React, { useState, useEffect } from 'react';
import { Lightbulb, AlertTriangle, CheckCircle2, Info, Loader2, Sparkles, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { generateProjectInsights, ProjectInsight } from '../services/geminiService';
import { PipeSegment, Annotation, ProductivitySettings, DailyProduction } from '../types';

interface SmartInsightsProps {
  pipes: PipeSegment[];
  annotations: Annotation[];
  settings: ProductivitySettings;
  production: DailyProduction[];
  progress: number;
  totalHH: number;
}

const SmartInsights: React.FC<SmartInsightsProps> = ({
  pipes,
  annotations,
  settings,
  production,
  progress,
  totalHH
}) => {
  const [insights, setInsights] = useState<ProjectInsight[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const result = await generateProjectInsights(pipes, annotations, settings, production, progress, totalHH);
      setInsights(result);
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [pipes.length, progress, totalHH]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL': return <AlertTriangle className="text-red-400" size={20} />;
      case 'WARNING': return <AlertTriangle className="text-amber-400" size={20} />;
      case 'SUCCESS': return <CheckCircle2 className="text-emerald-400" size={20} />;
      default: return <Info className="text-blue-400" size={20} />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'CRITICAL': return 'bg-red-500/10 border-red-500/20';
      case 'WARNING': return 'bg-amber-500/10 border-amber-500/20';
      case 'SUCCESS': return 'bg-emerald-500/10 border-emerald-500/20';
      default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={120} className="text-cyan-400" />
      </div>
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h3 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
          <Lightbulb size={16} /> AI SMART INSIGHTS (ANÁLISE PREDITIVA)
        </h3>
        <button 
          onClick={fetchInsights}
          disabled={loading}
          className="text-[10px] font-mono font-bold text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-2 uppercase"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
          Recalcular
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        {loading && insights.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 text-slate-500 gap-4">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
            <span className="text-[10px] font-mono uppercase tracking-widest">Processando dados do projeto...</span>
          </div>
        ) : (
          insights.map((insight, idx) => (
            <div 
              key={idx} 
              className={`p-4 rounded-xl border ${getBgColor(insight.type)} transition-all hover:scale-[1.01] cursor-default`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">{getIcon(insight.type)}</div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-slate-200 uppercase tracking-tight">{insight.title}</span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{insight.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Target size={12} className="text-cyan-400" />
                    <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Ação: {insight.recommendation}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && insights.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-[10px] font-mono uppercase tracking-widest">
          Nenhum insight disponível para os dados atuais.
        </div>
      )}
    </div>
  );
};

export default SmartInsights;
