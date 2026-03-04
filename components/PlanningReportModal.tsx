
import React from 'react';
import { X, Timer, Activity, TrendingUp, Users, Shield, Info, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

interface PlanningReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PlanningReportModal: React.FC<PlanningReportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-purple-500/30 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-purple-900/20 to-transparent flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-600/20">
              <Timer className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">RELATÓRIO DE ANÁLISE PROFISSIONAL</h2>
              <p className="text-purple-400 text-xs font-mono uppercase tracking-[0.2em]">Módulo de Planejamento 4D v2.5</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Section 1: Motor de Cálculo */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-purple-400">
              <TrendingUp size={20} />
              <h3 className="text-lg font-black uppercase tracking-widest">1. Motor de Cálculo e Técnicas</h3>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-3xl space-y-4 leading-relaxed text-slate-300">
              <p>
                O sistema utiliza a técnica de <strong className="text-white">Estimativa Paramétrica com Fatores de Ponderação</strong>, 
                alinhada às melhores práticas do <strong className="text-white">PMI</strong> e da <strong className="text-white">AACE International</strong>.
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <li className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  <span className="text-purple-400 font-bold block mb-1">Esforço Base:</span>
                  Extraído diretamente do modelo 3D (comprimento real) multiplicado pelo índice de produtividade (HH/m).
                </li>
                <li className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  <span className="text-purple-400 font-bold block mb-1">Fator de Saldo:</span>
                  Analisa o status atual (ex: Montado) e cobra apenas o esforço remanescente (ex: Solda e Teste).
                </li>
                <li className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  <span className="text-purple-400 font-bold block mb-1">Complexidade:</span>
                  Aplica multiplicadores para andaimes, trabalho noturno, áreas críticas e guindastes.
                </li>
                <li className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  <span className="text-purple-400 font-bold block mb-1">Atrasos (Delays):</span>
                  Permite a inclusão de horas de espera ou interferências externas no cálculo final.
                </li>
              </ul>
              <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-3 text-green-400 text-sm font-bold">
                <CheckCircle2 size={16} /> Veredito: Técnica profissional aderente à realidade de obras industriais.
              </div>
            </div>
          </section>

          {/* Section 2: Equipes e Crashing */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-blue-400">
              <Users size={20} />
              <h3 className="text-lg font-black uppercase tracking-widest">2. Alocação de Equipes e Prazo</h3>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-3xl space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                  <h4 className="text-white font-bold flex items-center gap-2"><Info size={14} className="text-blue-400"/> Por que o Saldo de Horas não muda?</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    O <strong className="text-white">Saldo de Horas (H/H)</strong> representa o <strong className="text-white">Esforço Total</strong> necessário. 
                    É o tamanho do trabalho físico. Se você coloca mais equipes, o trabalho não diminui, ele apenas é dividido entre mais pessoas.
                  </p>
                </div>
                <div className="flex-1 space-y-3">
                  <h4 className="text-white font-bold flex items-center gap-2"><TrendingUp size={14} className="text-green-400"/> O que muda é a Duração</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Ao aumentar as equipes, o sistema realiza o <strong className="text-white">Crashing (Compressão)</strong> do cronograma. 
                    A data de término é antecipada proporcionalmente à força de trabalho alocada.
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl">
                <p className="text-blue-300 text-xs font-mono italic">
                  "Exemplo: 88 HH com 1 equipe = 10 dias úteis. 88 HH com 2 equipes = 5 dias úteis. O esforço (88 HH) é constante, o prazo é dinâmico."
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Dashboard e Confiabilidade */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-green-400">
              <Activity size={20} />
              <h3 className="text-lg font-black uppercase tracking-widest">3. Gestão Visual e Confiabilidade</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-3xl space-y-2">
                <div className="text-white font-bold text-sm">Matriz de Status</div>
                <p className="text-slate-500 text-xs">Visualização clara do funil de produção (Pendente → Montado → Soldado).</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-3xl space-y-2">
                <div className="text-white font-bold text-sm">Curva de Produção</div>
                <p className="text-slate-500 text-xs">Medição real de metros instalados por dia para ajuste de metas.</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-3xl space-y-2">
                <div className="text-white font-bold text-sm">BOM Automática</div>
                <p className="text-slate-500 text-xs">Quantitativos extraídos do 3D, eliminando erros de contagem manual.</p>
              </div>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-3xl">
              <p className="text-slate-300 text-sm leading-relaxed">
                <strong className="text-white">Confiabilidade:</strong> A integração total com o modelo 3D garante que o planejamento 
                esteja sempre conectado à realidade física. A margem de erro de quantitativos é virtualmente zero.
              </p>
            </div>
          </section>

          {/* Section 4: Recomendações */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-yellow-400">
              <Lightbulb size={20} />
              <h3 className="text-lg font-black uppercase tracking-widest">4. Recomendações de Planejador Sênior</h3>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/20 p-6 rounded-3xl space-y-4">
              <div className="flex items-start gap-4">
                <div className="bg-yellow-500/20 p-2 rounded-lg mt-1"><TrendingUp size={16} className="text-yellow-500"/></div>
                <div>
                  <h4 className="text-white font-bold text-sm">Curva S (Planejado vs Realizado)</h4>
                  <p className="text-slate-500 text-xs">Utilize os dados de produção diária para plotar o progresso acumulado e identificar desvios precocemente.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-yellow-500/20 p-2 rounded-lg mt-1"><AlertTriangle size={16} className="text-yellow-500"/></div>
                <div>
                  <h4 className="text-white font-bold text-sm">Rendimento Decrescente</h4>
                  <p className="text-slate-500 text-xs">Cuidado ao alocar excesso de equipes em áreas pequenas. O tumulto pode gerar perda de produtividade (Lei de Brooks).</p>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-center">
          <button 
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-500 text-white font-black px-12 py-4 rounded-2xl shadow-xl shadow-purple-600/20 transition-all uppercase tracking-[0.2em] text-xs"
          >
            Fechar Relatório
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanningReportModal;
