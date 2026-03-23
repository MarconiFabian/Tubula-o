
import { GoogleGenAI } from "@google/genai";
import { PipeSegment, Annotation, ProductivitySettings, DailyProduction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
