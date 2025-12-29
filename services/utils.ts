
// Helper to format errors safely (ROBUST VERSION)
export const formatError = (e: any): string => {
    try {
        if (e === null || e === undefined) return "Erro desconhecido";

        // Se já for uma string, retorna
        if (typeof e === 'string') return e;

        // Trata erro padrão do JavaScript
        if (e instanceof Error) return e.message;

        // Trata erros vindos do Supabase ou APIs (padrão Postgrest)
        if (typeof e === 'object') {
            const message = e.message || e.error_description || e.details || e.error?.message;
            if (typeof message === 'string') {
                if (message.includes('duplicate key value') || message.includes('violates unique constraint')) {
                    return "Já existe um registro com este código ou nome na sua organização.";
                }
                return message;
            }

            // Caso seja um objeto sem campo de mensagem conhecido
            try {
                const str = JSON.stringify(e);
                return str === '{}' ? String(e) : str;
            } catch {
                return "Erro de estrutura de dados (não serializável)";
            }
        }

        return String(e);
    } catch (err) {
        return "Falha crítica ao processar mensagem de erro";
    }
};

export const safeNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};
