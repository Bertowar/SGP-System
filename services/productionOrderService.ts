import { supabase } from './supabaseClient';
import { getCurrentOrgId } from './auth';
import { ProductionOrder, ProductionOrderStatus, OrderStatusHistory } from '../types';
import { InventoryReservationService } from './inventoryReservationService';

/**
 * Service to manage Production Orders and their state transitions.
 */
export class ProductionOrderService {
    constructor(private reservationService: InventoryReservationService) { }

    /**
     * Change the status of a Production Order, validating the transition.
     */
    async changeStatus(orderId: string, newStatus: ProductionOrderStatus): Promise<ProductionOrder> {
        const orgId = await getCurrentOrgId();
        if (!orgId) throw new Error("Organização não identificada.");

        // 1. Buscar a ordem atual para validar transição
        const { data: order, error: fetchError } = await supabase
            .from('production_orders')
            .select('*')
            .eq('id', orderId)
            .eq('organization_id', orgId)
            .single();

        if (fetchError || !order) {
            throw new Error(`Ordem de Produção ${orderId} não encontrada.`);
        }

        if (!this.validateTransition(order.status as ProductionOrderStatus, newStatus)) {
            throw new Error(`Transição de status inválida de ${order.status} para ${newStatus}`);
        }

        const previousStatus = order.status as ProductionOrderStatus;

        // 2. Atualizar o status da ordem
        const { data: updatedOrder, error: updateError } = await supabase
            .from('production_orders')
            .update({ status: newStatus })
            .eq('id', orderId)
            .select()
            .single();

        if (updateError) throw updateError;

        // 3. Registrar o histórico de status (Audit Trail)
        await this.recordStatusHistory(orderId, previousStatus, newStatus);

        // 4. Acionar efeitos colaterais
        if (newStatus === 'CONFIRMED') {
            await this.reservationService.reserveMaterials(orderId);
        } else if (newStatus === 'CANCELLED') {
            await this.reservationService.releaseReservation(orderId);
        }

        return {
            id: updatedOrder.id,
            productCode: updatedOrder.product_code,
            targetQuantity: updatedOrder.target_quantity,
            status: updatedOrder.status,
            priority: updatedOrder.priority,
            createdAt: updatedOrder.created_at,
            organizationId: updatedOrder.organization_id
        } as any; // Cast simplificado para o exemplo
    }

    /**
     * Valida as transições permitidas.
     */
    private validateTransition(current: ProductionOrderStatus, target: ProductionOrderStatus): boolean {
        const allowed: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
            PLANNED: ['CONFIRMED', 'CANCELLED'],
            CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
            IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
            COMPLETED: [],
            CANCELLED: [],
        } as const;
        return allowed[current]?.includes(target) ?? false;
    }

    /**
     * Grava a mudança de status no histórico de auditoria.
     */
    private async recordStatusHistory(orderId: string, from: ProductionOrderStatus, to: ProductionOrderStatus) {
        const orgId = await getCurrentOrgId();

        const { error } = await supabase
            .from('order_status_history')
            .insert([{
                order_id: orderId,
                previous_status: from,
                new_status: to,
                organization_id: orgId, // RLS
                // changed_by será preenchido via trigger auth.uid() ou passado se necessário
            }]);

        if (error) {
            console.error("Erro ao gravar histórico de status:", error);
        }
    }

    /**
     * Busca o histórico de status de uma OP.
     */
    async getStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
        const orgId = await getCurrentOrgId();
        const { data, error } = await supabase
            .from('order_status_history')
            .select('*')
            .eq('order_id', orderId)
            .eq('organization_id', orgId)
            .order('changed_at', { ascending: false });

        if (error) return [];
        return data.map((d: any) => ({
            id: d.id,
            orderId: d.order_id,
            previousStatus: d.previous_status,
            newStatus: d.new_status,
            changedBy: d.changed_by,
            changedAt: d.changed_at
        }));
    }
}
