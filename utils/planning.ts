
import { PipeSegment, PipeStatus, InsulationStatus, ProductivitySettings, Annotation } from '../types';
import { PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR } from '../constants';

/**
 * Calcula o esforço (HH) de um segmento de tubo.
 */
export const calculatePipeHH = (
    pipe: PipeSegment, 
    prodSettings: ProductivitySettings,
    isPiping: boolean = true
): number => {
    const factor = isPiping 
        ? (PIPING_REMAINING_FACTOR[pipe.status] ?? 1) 
        : (INSULATION_REMAINING_FACTOR[pipe.insulationStatus || 'NONE'] ?? 1);
    
    if (factor === 0 && !isPiping) return 0; // Se não tem isolamento ou já acabou

    const baseProd = isPiping ? prodSettings.pipingBase : prodSettings.insulationBase;
    
    // Fator de Diâmetro (Pipes maiores levam mais tempo)
    // Usando 8" (aprox 200mm) como base 1.0
    const diameterFactor = isPiping ? Math.max(0.5, pipe.diameter / 200) : 1.0;
    
    let effort = pipe.length * baseProd * factor * diameterFactor;
    
    // Adicionar esforço de acessórios (apenas se for piping)
    if (isPiping) {
        const supportCount = (pipe.supports?.total || 0) + (pipe.accessories?.filter(a => a.type === 'SUPPORT').length || 0);
        const valveCount = pipe.accessories?.filter(a => a.type === 'VALVE').length || 0;
        const instrumentCount = pipe.accessories?.filter(a => a.type === 'INSTRUMENT').length || 0;
        const otherCount = pipe.accessories?.filter(a => a.type === 'OTHER').length || 0;

        // Se o tubo já está testado, o esforço remanescente dos acessórios é 0
        const supportFactor = PIPING_REMAINING_FACTOR[pipe.status] ?? 1;
        
        effort += supportCount * prodSettings.supportBase * supportFactor;
        effort += valveCount * (prodSettings.valveBase || 8) * supportFactor;
        effort += instrumentCount * (prodSettings.instrumentBase || 4) * supportFactor;
        effort += otherCount * (prodSettings.otherBase || 2) * supportFactor;
    }

    if (pipe.planningFactors) {
        let mult = 1.0;
        if (pipe.planningFactors.hasCrane) mult += prodSettings.weights.crane;
        if (pipe.planningFactors.hasBlockage) mult += prodSettings.weights.blockage;
        if (pipe.planningFactors.isNightShift) mult += prodSettings.weights.nightShift;
        if (pipe.planningFactors.isCriticalArea) mult += prodSettings.weights.criticalArea;
        if (pipe.planningFactors.accessType === 'SCAFFOLD_FLOOR') mult += prodSettings.weights.scaffoldFloor;
        if (pipe.planningFactors.accessType === 'SCAFFOLD_HANGING') mult += prodSettings.weights.scaffoldHanging;
        if (pipe.planningFactors.accessType === 'PTA') mult += prodSettings.weights.pta;
        
        if (pipe.planningFactors.weatherExposed) mult += prodSettings.globalConfig.weatherFactor;
        if (!pipe.planningFactors.materialAvailable) mult += prodSettings.globalConfig.materialDelayFactor;

        effort *= mult;
        effort *= (1 + prodSettings.globalConfig.reworkFactor);

        if (isPiping && factor > 0) effort += (pipe.planningFactors.delayHours || 0);
    }

    return effort;
};

/**
 * Calcula o esforço total do projeto.
 */
export const calculateTotalHH = (
    pipes: PipeSegment[],
    annotations: Annotation[],
    prodSettings: ProductivitySettings
) => {
    let totalPipingHH = 0;
    let totalInsulationHH = 0;
    let annotationHH = 0;

    pipes.forEach(p => {
        totalPipingHH += calculatePipeHH(p, prodSettings, true);
        totalInsulationHH += calculatePipeHH(p, prodSettings, false);
    });

    annotations.forEach(a => {
        if (a.estimatedHours) annotationHH += a.estimatedHours;
    });

    const totalHH = (totalPipingHH + totalInsulationHH + annotationHH) * (1 + prodSettings.globalConfig.safetyBuffer);

    return { totalPipingHH, totalInsulationHH, annotationHH, totalHH };
};

/**
 * Calcula a data de término considerando apenas dias úteis (segunda a sexta).
 * @param startDate Data de início
 * @param daysNeeded Quantidade de dias de trabalho necessários
 * @returns Data de término projetada
 */
export const getWorkingEndDate = (startDate: Date, daysNeeded: number, includeWeekends: boolean = false): Date => {
    let result = new Date(startDate);
    let addedDays = 0;
    
    let daysToTarget = daysNeeded > 0 ? daysNeeded - 1 : 0;
    
    while (addedDays < daysToTarget) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay();
        if (includeWeekends || (dow !== 0 && dow !== 6)) addedDays++;
    }
    
    if (!includeWeekends) {
        while (result.getDay() === 0 || result.getDay() === 6) {
            result.setDate(result.getDate() + 1);
        }
    }
    
    return result;
};

/**
 * Calcula a quantidade de dias úteis entre duas datas (inclusive).
 * @param startDate Data de início
 * @param endDate Data de término
 * @returns Quantidade de dias úteis
 */
export const getWorkingDaysBetween = (startDate: Date, endDate: Date, includeWeekends: boolean = false): number => {
    let count = 0;
    const curDate = new Date(startDate);
    const end = new Date(endDate);
    
    curDate.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    while (curDate <= end) {
        const dayOfWeek = curDate.getDay();
        if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};
