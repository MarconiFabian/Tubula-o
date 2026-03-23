
import { GoogleGenAI } from "@google/genai";
import { PipeSegment, Annotation, ProductivitySettings, DailyProduction } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const getEnv = (key: string): string => {
      try {
        if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
      } catch (e) {
        // Ignore errors in env access
      }
      return '';
    };

    const apiKey = getEnv('GEMINI_API_KEY') || getEnv('VITE_GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found in environment variables');
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
}

export interface ProjectInsight {
  type: 'WARNING' | 'SUCCESS' | 'INFO' | 'CRITICAL';
  title: string;
  description: string;
  recommendation: string;
}

export async function generateProjectInsights(
  pipes: PipeSegment[],
  annotations: Annotation[],
  settings: ProductivitySettings,
  production: DailyProduction[],
  progress: number,
  totalHH: number
): Promise<ProjectInsight[]> {
  const ai = getAI();
  const prompt = `
    Analyze the following industrial piping project data and provide 3-4 professional insights.
    
    Project Data:
    - Total Pipes: ${pipes.length}
    - Total Progress: ${progress.toFixed(2)}%
    - Total Estimated Man-Hours (HH): ${totalHH.toFixed(1)}h
    - Productivity Settings: Base Piping ${settings.pipingBase}h/m, Base Insulation ${settings.insulationBase}h/m
    - Annotations (Support/Obstacles): ${annotations.length} items
    - Daily Production Records: ${production.length} days recorded
    
    Status Breakdown:
    ${pipes.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as any)}
    
    Insulation Breakdown:
    ${pipes.reduce((acc, p) => {
      acc[p.insulationStatus || 'NONE'] = (acc[p.insulationStatus || 'NONE'] || 0) + 1;
      return acc;
    }, {} as any)}

    Consider:
    1. Bottlenecks (e.g., many pipes mounted but not welded).
    2. Productivity trends.
    3. Resource allocation (team counts).
    4. Risks (weather, material availability).
    
    Return the response as a JSON array of objects with the following structure:
    {
      "type": "WARNING" | "SUCCESS" | "INFO" | "CRITICAL",
      "title": "Short title",
      "description": "Detailed observation",
      "recommendation": "Actionable advice"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      {
        type: 'INFO',
        title: 'Análise Indisponível',
        description: 'Não foi possível gerar insights automáticos no momento.',
        recommendation: 'Verifique sua conexão ou tente novamente mais tarde.'
      }
    ];
  }
}
