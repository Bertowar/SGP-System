import { Product, RawMaterial, ProductBOMHeader } from '../types';

export const calculateKittingOptions = (products: Product[], materials: RawMaterial[], boms: ProductBOMHeader[]) => {
    // boms is now a list of Headers with Items included
    return products.map(p => {
        // Find the active BOM for this product
        const activeBOM = boms.find(b => b.productId === p.id);

        if (!activeBOM || !activeBOM.items || activeBOM.items.length === 0) {
            return null; // Product has no BOM or no items
        }

        let maxKits = Infinity;

        const details = activeBOM.items.map(bomItem => {
            const material = materials.find(m => m.id === bomItem.materialId);
            const currentStock = material?.currentStock || 0;
            const requiredPerUnit = bomItem.quantity;

            // Avoid division by zero
            if (requiredPerUnit <= 0) return {
                materialId: bomItem.materialId,
                name: material?.name || 'Unknown',
                required: requiredPerUnit,
                stock: currentStock,
                possible: Infinity
            };

            const possible = Math.floor(currentStock / requiredPerUnit);
            if (possible < maxKits) maxKits = possible;

            return {
                materialId: bomItem.materialId,
                name: material?.name,
                required: requiredPerUnit,
                stock: currentStock,
                possible
            };
        });

        // If maxKits implies we can make 0, we still return the object so user sees they can't make it (limit 0)
        // But if maxKits is still Infinity (no items required?), set to 0? Handled above with length check.
        if (maxKits === Infinity) maxKits = 0;

        return { product: p, maxKits, components: details };
    }).filter(k => k !== null); // Remove products without BOMs
};
