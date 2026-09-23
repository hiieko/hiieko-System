import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Site, t } from '@solar/shared';
import { enqueueOperation, generateIdempotencyKey } from '../services/syncQueue';
import { apiClient } from '../services/apiClient';
import { PageIntro } from '../components/PageIntro';
import { ReceiptScanFlow, ReceiptScanFlowProps } from './ReceiptScanFlow';

const CATS = ['fuel','accommodation','food','transport','parking','tolls','materials','tools','equipment','other'];
const CAT_LABELS: Record<string,string> = { fuel:'Combustibil', accommodation:'Cazare', food:'Mancare', transport:'Transport', parking:'Parcare', tolls:'Taxe drum', materials:'Materiale', tools:'Scule', equipment:'Echipamente', other:'Altele' };
const PAYS = [{v:'personal',l:'Platit personal'},{v:'company_card',l:'Card companie'},{v:'company_cash',l:'Cash avans'},{v:'other',l:'Alta'}];

interface Props { user: { id: string; full_name: string }; sites: Site[]; isOffline: boolean; locale?: 'ro' | 'en'; }

export function WorkerExpenseScreen({ user, sites, isOffline, locale = 'ro' }: Props) {
  const [siteId, setSiteId] = useState(sites[0]?.id || '');
  const [category, setCategory] = useState('fuel');
  const [payMethod, setPayMethod] = useState('personal');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) { Alert.alert('Eroare', 'Introdu o suma valida.'); return; }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      // Map to backend CreateExpenseDto format
      const expensePayload = {
        projectId: siteId,
        category: category as any,
        paymentMethod: payMethod as any,
        amount: Number(amount),
        currency: 'RON',
        expenseDate: now.split('T')[0],
        description: description || `Cheltuiala ${category}`,
        merchantName: hasPhoto ? 'Cu bon atasat' : undefined,
      };
      const idemKey = generateIdempotencyKey('expense', 'create');

      if (isOffline) {
        // Enqueue for later sync (SQLite-based queue)
        await enqueueOperation('expense', 'create', expensePayload, idemKey);
        Alert.alert('Salvat Offline', 'Cheltuiala a fost salvata local si se va sincroniza cand veti avea internet.');
      } else {
        // Submit directly to API
        await apiClient.createExpense(expensePayload, idemKey);
        Alert.alert('Trimis!', `${amount} RON trimis pentru aprobare.`);
      }
      setAmount(''); setDescription(''); setHasPhoto(false);
    } catch (e: any) {
      console.error('Expense submit error:', e);
      Alert.alert('Eroare', e.message || 'Nu s-a putut salva cheltuiala.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanComplete: ReceiptScanFlowProps['onComplete'] = (_draft, outcome) => {
    setScannerVisible(false);
    if (outcome.submitted) Alert.alert(t('general.success', locale), `${outcome.expenseId || ''} — trimis pentru aprobare.`);
    else if (outcome.queued) Alert.alert(t('status.saved_offline', locale), t('err.upload_failed_preserved', locale));
    else Alert.alert(t('general.error', locale), outcome.message || '');
  };

  return (
    <>
      <ScrollView contentContainerStyle={s.c}>
        <PageIntro sectionId="expenses" locale={locale} role="worker" />
        <Text style={s.title}>CHELTUIALA NOUA</Text>
        <Text style={s.sub}>Fotografiaza documentul si completeaza detaliile.</Text>

        <View style={s.card}>
          <Text style={s.ct}>SCANARE DOCUMENT</Text>
          <TouchableOpacity style={s.photoBtn} onPress={() => setScannerVisible(true)}>
            <Text style={s.photoBtnText}>{t('scan.open', locale)}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.ct}>FOTO DOCUMENT (manual)</Text>
          <TouchableOpacity style={s.photoBtn} onPress={() => { setHasPhoto(true); Alert.alert('Foto OK', 'Document fotografiat.'); }}>
            <Text style={s.photoBtnText}>{hasPhoto ? 'FOTO ATASATA' : 'FOTOGRAFIAZA BON / FACTURA'}</Text>
          </TouchableOpacity>
        </View>
      <View style={s.card}>
        <Text style={s.ct}>CATEGORIE</Text>
        <View style={s.chips}>{CATS.map(c => (
          <TouchableOpacity key={c} style={[s.chip, category===c && s.chipA]} onPress={() => setCategory(c)}>
            <Text style={[s.chipT, category===c && s.chipTA]}>{CAT_LABELS[c]}</Text>
          </TouchableOpacity>))}</View>
      </View>
      <View style={s.card}>
        <Text style={s.ct}>SANTIER</Text>
        <View style={s.chips}>{sites.map(st => (
          <TouchableOpacity key={st.id} style={[s.chip, siteId===st.id && s.chipA]} onPress={() => setSiteId(st.id)}>
            <Text style={[s.chipT, siteId===st.id && s.chipTA]}>{st.name}</Text>
          </TouchableOpacity>))}</View>
      </View>
      <View style={s.card}>
        <Text style={s.ct}>METODA PLATA</Text>
        <View style={s.chips}>{PAYS.map(p => (
          <TouchableOpacity key={p.v} style={[s.chip, payMethod===p.v && s.chipA]} onPress={() => setPayMethod(p.v)}>
            <Text style={[s.chipT, payMethod===p.v && s.chipTA]}>{p.l}</Text>
          </TouchableOpacity>))}</View>
      </View>
      <View style={s.card}>
        <Text style={s.ct}>SUMA (RON)</Text>
        <TextInput style={s.input} placeholder="Ex: 250.00" placeholderTextColor="#64748b" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Text style={s.lbl}>Descriere</Text>
        <TextInput style={s.input} placeholder="Ex: Combustibil" placeholderTextColor="#64748b" value={description} onChangeText={setDescription} />
      </View>
      <TouchableOpacity style={s.submit} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#0f172a" /> : <Text style={s.submitT}>TRIMITE PENTRU APROBARE</Text>}
      </TouchableOpacity>
      </ScrollView>

      <ReceiptScanFlow
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onComplete={handleScanComplete}
        userId={user.id}
        sites={sites}
        defaultSiteId={siteId}
        locale={locale}
      />
    </>
  );
}

const s = StyleSheet.create({
  c: { padding: 16, backgroundColor: '#0f172a', flexGrow: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#94a3b8', marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  ct: { fontSize: 11, fontWeight: '700', color: '#f59e0b', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#334155' },
  chipA: { backgroundColor: '#f59e0b' },
  chipT: { fontSize: 12, fontWeight: '600', color: '#cbd5e1' },
  chipTA: { color: '#0f172a', fontWeight: '800' },
  photoBtn: { backgroundColor: '#0284c7', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  photoBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  lbl: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  submit: { backgroundColor: '#10b981', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginVertical: 12 },
  submitT: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
});
