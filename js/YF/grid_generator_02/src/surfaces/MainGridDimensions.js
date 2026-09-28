/** The main grid follows artwork orientation; the dieline stays in physical coordinates. */
export function mainGridDimensions(settings) {
    const rotation = settings.get('surfaceSettings')?.front?.rotation ?? 0;
    const swapsAxes = rotation === 90 || rotation === 270;
    return {
        frontWidth: settings.get(swapsAxes ? 'frontHeight' : 'frontWidth'),
        frontHeight: settings.get(swapsAxes ? 'frontWidth' : 'frontHeight')
    };
}
