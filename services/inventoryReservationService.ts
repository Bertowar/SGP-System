import { MaterialReservation, ReservationStatus } from '../types';

/**
 * Service responsible for reserving and releasing material quantities for a Production Order.
 * In a real implementation this would interact with the database and inventory tables.
 */
export class InventoryReservationService {
    // In‑memory store for demo purposes
    private reservations: Map<string, MaterialReservation> = new Map();

    /**
     * Reserve all required materials for the given production order.
     * This is a placeholder that creates dummy reservations.
     */
    async reserveMaterials(orderId: string): Promise<void> {
        // TODO: calculate required materials based on BOM – using dummy data for now
        const dummyReservation: MaterialReservation = {
            id: `res-${orderId}`,
            organizationId: 'org-1',
            productionOrderId: orderId,
            materialId: 'mat-1',
            quantity: 100,
            status: 'PENDING',
        };
        this.reservations.set(dummyReservation.id, dummyReservation);
        console.log('Materials reserved for order', orderId, dummyReservation);
    }

    /**
     * Release any reservations associated with the given order (e.g., on cancellation).
     */
    async releaseReservation(orderId: string): Promise<void> {
        for (const [id, res] of this.reservations.entries()) {
            if (res.productionOrderId === orderId && res.status === 'PENDING') {
                res.status = 'RELEASED';
                this.reservations.set(id, res);
                console.log('Reservation released', id);
            }
        }
    }
}
