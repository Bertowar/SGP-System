export const calculateKittingOptions = (products: any[], materials: any[], boms: any[]) => {
    // Logic to find which products have BOMs, and calculate max possible yield
    return products.filter(p => {
        const productBOM = boms.filter(b => b.productCode === p.code);
        return productBOM.length > 0;
    }).map(p => {
        const productBOM = boms.filter(b => b.productCode === p.code);
        let maxKits = Infinity;
        const details = productBOM.map(bom => {
            const material = materials.find(m => m.id === bom.materialId);
            const currentStock = material?.currentStock || 0;
            const possible = Math.floor(currentStock / bom.quantityRequired);
            if (possible < maxKits) maxKits = possible;
            return { materialId: material?.id, name: material?.name, required: bom.quantityRequired, stock: currentStock, possible };
        });
        return { product: p, maxKits: maxKits === Infinity ? 0 : maxKits, components: details };
    }).filter(k => k.maxKits > 0); // Only show kits we can actually build? Or show all? Show all better.
};
