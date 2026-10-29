import { suggestDescriptiveFilename, suggestDocumentClassification } from './documents.classification';

const projects = [
  { id: 'project-1', name: 'Parc Fotovoltaic Bucecea', code: 'BCJ-09', address: 'Bucecea, Botoșani' },
  { id: 'project-2', name: 'Parc Fotovoltaic Fălticeni', code: 'FLT-01', address: 'Fălticeni, Suceava' },
];

describe('suggestDocumentClassification', () => {
  it('suggests a category from Romanian filename evidence and an exact project code', () => {
    const result = suggestDocumentClassification({
      fileName: 'BCJ-09 Contract de execuție.pdf',
      title: 'Contract de execuție',
      mimeType: 'application/pdf',
      projects,
    });

    expect(result.categories[0]).toMatchObject({ value: 'CONTRACT', confidence: 'high' });
    expect(result.projects[0]).toMatchObject({
      value: { id: 'project-1' },
      confidence: 'high',
    });
    expect(result.categories[0].explanation).toContain('contract');
  });

  it('uses drawing extensions as evidence without claiming preview support', () => {
    const result = suggestDocumentClassification({
      fileName: 'BCJ-09 single line.dwg',
      projects,
    });

    expect(result.categories[0]).toMatchObject({ value: 'PLAN_TEHNIC', confidence: 'high' });
    expect(result.projects[0].value.id).toBe('project-1');
  });

  it('returns competing category candidates instead of choosing between conflicting terms', () => {
    const result = suggestDocumentClassification({
      fileName: 'Factura și proces verbal recepție.pdf',
      projects: [],
    });

    expect(result.categories.map(({ value }) => value)).toEqual(['FACTURA', 'PROCES_VERBAL']);
    expect(result.projects).toEqual([]);
  });

  it('does not invent a project or a category when names and identifiers are inconclusive', () => {
    const result = suggestDocumentClassification({
      fileName: 'Scan 2026-08-02.pdf',
      mimeType: 'application/pdf',
      currentCategory: 'OTHER',
      projects,
    });

    expect(result.categories).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.evidence).toContain('documents.suggestion_evidence_current_category|OTHER');
  });
});

describe('suggestDescriptiveFilename', () => {
  it('uses only existing project, code, category and title evidence while preserving the source extension', () => {
    expect(suggestDescriptiveFilename({
      sourceName: 'scan001.PDF',
      title: 'scan001.PDF',
      code: 'INV-03',
      projectCode: 'TM-002',
      documentType: 'CONTRACT',
      mimeType: 'application/pdf',
    })).toEqual({
      filename: 'TM-002_INV-03_contract_scan001.PDF',
      explanation: 'documents.filename_suggestion_evidence',
    });
  });

  it('does not duplicate evidence already present in the title or invent content/date tokens', () => {
    expect(suggestDescriptiveFilename({
      sourceName: 'TM-002_contract.pdf',
      title: 'TM-002_contract.pdf',
      projectCode: 'TM-002',
      documentType: 'CONTRACT',
      mimeType: 'application/pdf',
    })?.filename).toBe('TM-002_contract.pdf');

    expect(suggestDescriptiveFilename({ sourceName: 'scan001.pdf' })?.filename).toBe('scan001.pdf');
  });
});
