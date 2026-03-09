
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
