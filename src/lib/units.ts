export const MM_PER_INCH = 25.4;

/** PDF points (1/72 inch) from millimetres. 1mm = 2.8346pt. */
export const mmToPt = (mm: number) => (mm * 72) / MM_PER_INCH;

/** Pixels per millimetre at a given dpi. */
export const pxPerMm = (dpi: number) => dpi / MM_PER_INCH;

export const mmToPx = (mm: number, dpi: number) => Math.round(mm * pxPerMm(dpi));
