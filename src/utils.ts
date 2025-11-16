import path from 'path';

/**
 * Utility functions for fs-box-sync
 */

/**
 * Format date folder names based on locale
 *
 * @param date - Date to format
 * @param locale - Locale (e.g., 'en-US', 'ja-JP')
 * @param yearFormat - Custom year format
 * @param monthFormat - Custom month format
 * @returns Object with year and month folder names
 *
 * @example
 * // English
 * formatDateFolders(new Date('2024-03-15'), 'en-US')
 * // => { year: '2024', month: 'March' }
 *
 * // Japanese
 * formatDateFolders(new Date('2024-03-15'), 'ja-JP')
 * // => { year: '2024年', month: '3月' }
 *
 * // Custom
 * formatDateFolders(new Date('2024-03-15'), 'en-US', 'YYYY', 'MM')
 * // => { year: '2024', month: '03' }
 */
export function formatDateFolders(
  date: Date = new Date(),
  locale: string = 'en-US',
  yearFormat?: string,
  monthFormat?: string
): { year: string; month: string } {
  // If custom formats provided, use them
  if (yearFormat || monthFormat) {
    const year = yearFormat || 'YYYY';
    const month = monthFormat || 'M';

    return {
      year: year.replace('YYYY', date.getFullYear().toString()),
      month: month.replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
                  .replace('M', String(date.getMonth() + 1)),
    };
  }

  // Locale-based formatting
  if (locale.startsWith('ja')) {
    // Japanese: 2024年, 3月
    return {
      year: `${date.getFullYear()}年`,
      month: `${date.getMonth() + 1}月`,
    };
  } else if (locale.startsWith('zh')) {
    // Chinese: 2024年, 3月
    return {
      year: `${date.getFullYear()}年`,
      month: `${date.getMonth() + 1}月`,
    };
  } else {
    // English and others: 2024, March
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return {
      year: date.getFullYear().toString(),
      month: monthNames[date.getMonth()],
    };
  }
}

/**
 * Generate Box Office Online URL
 * Creates a URL to open files in Box Office Online (editable mode)
 *
 * @param fileId - Box file ID
 * @param domain - Box domain (e.g., 'app.box.com', 'foo.app.box.com')
 * @returns Office Online URL
 *
 * @example
 * getBoxOfficeOnlineUrl('123456', 'app.box.com')
 * // => 'https://app.box.com/integrations/officeonline/openOfficeOnline?fileId=123456&sharedAccessCode='
 */
export function getBoxOfficeOnlineUrl(fileId: string, domain: string = 'app.box.com'): string {
  return `https://${domain}/integrations/officeonline/openOfficeOnline?fileId=${fileId}&sharedAccessCode=`;
}

/**
 * Sanitize filename for safe filesystem usage
 * Removes invalid characters for Windows/Mac/Linux
 */
export function sanitizeFilename(filename: string): string {
  // Remove invalid characters: \ / : * ? " < > |
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const ext = path.extname(filename);
  return ext ? ext.substring(1) : '';
}

/**
 * Check if file is Office file type
 */
export function isOfficeFile(filename: string): boolean {
  const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  const ext = getFileExtension(filename).toLowerCase();
  return officeExtensions.includes(ext);
}
