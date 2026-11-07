// Documents shown on /documents/. A document with `file` set and present in /files/ becomes a
// download; otherwise the row shows an email request link. To publish one: put the REDACTED PDF
// in files/ with the name below, then run `node scripts/build.mjs`.
// Redaction checklist before publishing any file: remove student number, ID numbers, date of
// birth, home address and phone numbers other than the public one; get written consent from the
// author of any letter.

export const DOCUMENTS = [
  {
    id: 'cv',
    name: 'Curriculum vitae',
    detail: 'One-page, data and AI focused, and full versions.',
    links: [
      ['One page', '/files/Kampolo-Tomas-CV.pdf'],
      ['Data & AI, one page', '/files/Kampolo-Tomas-CV-Data.pdf'],
      ['Full', '/files/Kampolo-Tomas-CV-Full.pdf'],
    ],
  },
  {
    id: 'mit',
    name: 'MIT Open Learning — Universal AI Programme',
    detail: '19 course certificates, Feb–Jun 2026.',
    file: 'MIT-Universal-AI-Certificates.pdf',
  },
  {
    id: 'hp',
    name: 'HP LIFE and other short courses',
    detail: 'IT for Business Success, Customer Experience, Social Media Marketing; Project Management 101; IT Customer Support Basics.',
    file: 'HP-LIFE-and-Short-Course-Certificates.pdf',
  },
  {
    id: 'transcript',
    name: 'Academic transcript (NUST)',
    detail: 'Redacted copy: student number removed.',
    file: 'NUST-Academic-Transcript-Redacted.pdf',
  },
  {
    id: 'letters',
    name: 'Reference and recommendation letters',
    detail: 'Shared with the author’s consent.',
    file: 'Reference-Letters.pdf',
  },
  {
    id: 'other',
    name: 'Anything else',
    detail: 'Further documents on request.',
    requestOnly: true,
  },
];
