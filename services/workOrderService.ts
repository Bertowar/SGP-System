import { supabase } from './supabaseClient';
import { getCurrentOrgId } from './auth';
import { WorkOrder, WorkOrderActivity } from '../types';

/**
 * Serviço responsável por registrar a execução de uma operação
 * (produção e rejeição) vinculada a um Work Order.
 */
export const recordWorkOrderActivity = async (params: {
    workOrderId: string;
    operationId: string;
    operatorId: string;
    producedQty: number;
    rejectedQty: number;
    materialUsed?: Record<string, any>;
}): Promise<WorkOrderActivity> => {
    const {
        workOrderId,
        operationId,
        operatorId,
        producedQty,
        rejectedQty,
        materialUsed,
    } = params;

    const orgId = await getCurrentOrgId();
    if (!orgId) throw new Error("Organização não identificada.");

    // 1. Verifica se o Work Order existe e pertence à organização
    const { data: workOrder, error: woError } = await supabase
        .from('production_order_steps')
        .select('*')
        .eq('id', workOrderId)
        .eq('organization_id', orgId)
        .single();

    if (woError || !workOrder) {
        throw new Error(`Ordem de Trabalho ${workOrderId} não encontrada.`);
    }

    // 2. Insere registro na tabela work_order_activity
    const { data, error } = await supabase
        .from('work_order_activity')
        .insert([{
            work_order_id: workOrderId,
            operation_id: operationId,
            operator_id: operatorId,
            produced_qty: producedQty,
            rejected_qty: rejectedQty,
            material_used: materialUsed || null,
            organization_id: orgId // Assuming organization_id exists in this table too for RLS
        }])
        .select()
        .single();

    if (error) {
        console.error("Erro ao registrar atividade:", error);
        throw error;
    }

    // 3. Opcional: Atualizar a quantidade produzida/rejeitada no Work Order
    // Isso pode ser feito via trigger no banco ou aqui explicitamente.
    // Por segurança, vamos atualizar aqui também.
    const newProduced = (workOrder.qty_produced || 0) + producedQty;
    const newRejected = (workOrder.qty_rejected || 0) + rejectedQty;

    await supabase
        .from('production_order_steps')
        .update({
            qty_produced: newProduced,
            qty_rejected: newRejected,
            status: newProduced >= workOrder.qty_planned ? 'COMPLETED' : 'IN_PROGRESS'
        })
        .eq('id', workOrderId);

    return {
        id: data.id,
        workOrderId: data.work_order_id,
        operationId: data.operation_id,
        operatorId: data.operator_id,
        producedQty: data.produced_qty,
        rejectedQty: data.rejected_qty,
        materialUsed: data.material_used,
        recordedAt: data.recorded_at
    };
};

export const fetchWorkOrderHistory = async (workOrderId: string): Promise<WorkOrderActivity[]> => {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
        .from('work_order_activity')
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('organization_id', orgId)
        .order('recorded_at', { ascending: false });

    if (error) return [];
    return data.map((d: any) => ({
        id: d.id,
        workOrderId: d.work_order_id,
        operationId: d.operation_id,
        operatorId: d.operator_id,
        producedQty: d.produced_qty,
        rejectedQty: d.rejected_qty,
        materialUsed: d.material_used,
        recordedAt: d.recorded_at
    }));
};
