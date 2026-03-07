
/**
 * Calcula a data de término considerando apenas dias úteis (segunda a sexta).
 * @param startDate Data de início
 * @param daysNeeded Quantidade de dias de trabalho necessários
 * @returns Data de término projetada
 */
export const getWorkingEndDate = (startDate: Date, daysNeeded: number): Date => {
    let result = new Date(startDate);
    let addedDays = 0;
    
    // Se precisar de 1 dia, termina no próprio dia (se for útil)
    // Se precisar de 0 dias, termina no próprio dia
    let daysToTarget = daysNeeded > 0 ? daysNeeded - 1 : 0;
    
    while (addedDays < daysToTarget) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay();
        if (dow !== 0 && dow !== 6) addedDays++;
    }
    
    // Garante que se cair no fim de semana, pula para a próxima segunda
    while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
    }
    
    return result;
};

/**
 * Calcula a quantidade de dias úteis entre duas datas (inclusive).
 * @param startDate Data de início
 * @param endDate Data de término
 * @returns Quantidade de dias úteis
 */
export const getWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const curDate = new Date(startDate);
    const end = new Date(endDate);
    
    // Normalizar para meia-noite para evitar problemas de hora
    curDate.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    while (curDate <= end) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};
