import { parseMomoSms, referenceNote, splitMessages } from './parseMomoSms';

// Illustrative messages in the usual shapes (English and French). Real operator wording varies;
// add real, anonymised samples here when tuning the patterns.
const MTN_SENT_EN =
  'You have transferred 15,000 FCFA to JEAN NKOMO (237677123456) on 2026-09-12 14:03:22. Fee: 150 FCFA. Your new balance: 42,350 FCFA. Financial Transaction Id: 8812345678.';
const MTN_RECEIVED_FR =
  'Vous avez recu 50 000 FCFA de MARIE ATANGA (237699112233) le 12/09/2026 a 09:15. Nouveau solde: 92 350 FCFA. ID transaction: 8812349999.';
const ORANGE_PAYMENT_FR =
  'Orange Money: Paiement de 7.500 FCFA chez ENEO CAMEROUN effectue le 13-09-26 10h20. Frais: 0 FCFA. Solde: 34.850 FCFA. Ref: PP260913.1020.A12345';
const WITHDRAWAL_EN = 'Cash out of XAF 20000 at agent 677000111 successful. Fee XAF 250. Balance XAF 14600. Trans ID: CO998877';

describe('parseMomoSms', () => {
  it('reads a sent transfer with fee, balance, counterparty, reference and date', () => {
    const { ok, confidence, fields } = parseMomoSms(MTN_SENT_EN);
    expect(ok).toBe(true);
    expect(confidence).toBe('high');
    expect(fields).toMatchObject({ kind: 'sent', operator: 'unknown', amount: 15_000, fee: 150, balance: 42_350, reference: '8812345678' });
    expect(fields.counterparty).toBe('JEAN NKOMO (677123456)');
    expect(new Date(fields.occurredAt!).getDate()).toBe(12);
  });

  it('reads a French "received" message with space thousands separators', () => {
    const { fields } = parseMomoSms(MTN_RECEIVED_FR);
    expect(fields).toMatchObject({ kind: 'received', amount: 50_000, fee: null, balance: 92_350, reference: '8812349999' });
    expect(fields.counterparty).toBe('MARIE ATANGA (699112233)');
    expect(new Date(fields.occurredAt!).getMonth()).toBe(8);
  });

  it('reads an Orange Money merchant payment with dot separators and a zero fee', () => {
    const { fields } = parseMomoSms(ORANGE_PAYMENT_FR);
    expect(fields).toMatchObject({ kind: 'payment', operator: 'orange', amount: 7_500, balance: 34_850, reference: 'PP260913.1020.A12345' });
    expect(fields.counterparty).toBe('ENEO CAMEROUN');
  });

  it('reads a withdrawal with the currency before the number', () => {
    const { fields } = parseMomoSms(WITHDRAWAL_EN);
    expect(fields).toMatchObject({ kind: 'withdrawal', amount: 20_000, fee: 250, balance: 14_600, reference: 'CO998877' });
  });

  it('reports low confidence instead of throwing on unrelated text', () => {
    const result = parseMomoSms('Your data bundle expires tomorrow. Dial *123#.');
    expect(result.ok).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.missing).toContain('amount');
  });
});

describe('splitMessages', () => {
  it('splits a paste of several messages on blank lines', () => {
    expect(splitMessages(`${MTN_SENT_EN}\n\n  \n${MTN_RECEIVED_FR}\n`)).toHaveLength(2);
  });
});

describe('referenceNote', () => {
  it('stores the reference in a findable form', () => {
    expect(referenceNote('8812345678')).toBe('MoMo ref 8812345678');
  });
});
