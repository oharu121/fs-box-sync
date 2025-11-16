import { describe, it, expect } from 'vitest';
import { formatDateFolders, getBoxOfficeOnlineUrl, sanitizeFilename, getFileExtension, isOfficeFile } from './utils';

describe('formatDateFolders', () => {
  it('should format date with default locale (en-US)', () => {
    const date = new Date('2024-03-15');
    const result = formatDateFolders(date);
    expect(result.year).toBe('2024');
    expect(result.month).toBe('March');
  });

  it('should format date with Japanese locale', () => {
    const date = new Date('2024-03-15');
    const result = formatDateFolders(date, 'ja-JP');
    expect(result.year).toBe('2024年');
    expect(result.month).toBe('3月');
  });

  it('should format date with custom year and month format', () => {
    const date = new Date('2024-03-15');
    const result = formatDateFolders(date, 'en-US', 'YYYY', 'MM');
    expect(result.year).toBe('2024');
    expect(result.month).toBe('03');
  });

  it('should use current date if no date provided', () => {
    const result = formatDateFolders();
    expect(result.year).toMatch(/^\d{4}$/);
    expect(result.month).toBeTruthy();
  });
});

describe('getBoxOfficeOnlineUrl', () => {
  it('should generate Office Online URL with default domain', () => {
    const url = getBoxOfficeOnlineUrl('123456');
    expect(url).toBe('https://app.box.com/integrations/officeonline/openOfficeOnline?fileId=123456&sharedAccessCode=');
  });

  it('should generate Office Online URL with custom domain', () => {
    const url = getBoxOfficeOnlineUrl('123456', 'foo.app.box.com');
    expect(url).toBe(
      'https://foo.app.box.com/integrations/officeonline/openOfficeOnline?fileId=123456&sharedAccessCode='
    );
  });
});

describe('sanitizeFilename', () => {
  it('should replace invalid characters with underscores', () => {
    expect(sanitizeFilename('file<>:"/\\|?*.txt')).toBe('file_________.txt');
  });

  it('should keep valid filename unchanged', () => {
    expect(sanitizeFilename('valid-file_name.txt')).toBe('valid-file_name.txt');
  });

  it('should handle empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});

describe('getFileExtension', () => {
  it('should return file extension without dot', () => {
    expect(getFileExtension('document.pdf')).toBe('pdf');
  });

  it('should return extension for files with multiple dots', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('should return empty string for files without extension', () => {
    expect(getFileExtension('README')).toBe('');
  });
});

describe('isOfficeFile', () => {
  it('should return true for Word documents', () => {
    expect(isOfficeFile('document.docx')).toBe(true);
    expect(isOfficeFile('document.doc')).toBe(true);
  });

  it('should return true for Excel spreadsheets', () => {
    expect(isOfficeFile('spreadsheet.xlsx')).toBe(true);
    expect(isOfficeFile('spreadsheet.xls')).toBe(true);
  });

  it('should return true for PowerPoint presentations', () => {
    expect(isOfficeFile('presentation.pptx')).toBe(true);
    expect(isOfficeFile('presentation.ppt')).toBe(true);
  });

  it('should return false for non-office files', () => {
    expect(isOfficeFile('document.pdf')).toBe(false);
    expect(isOfficeFile('image.png')).toBe(false);
    expect(isOfficeFile('script.js')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isOfficeFile('DOCUMENT.DOCX')).toBe(true);
    expect(isOfficeFile('Document.Xlsx')).toBe(true);
  });
});
