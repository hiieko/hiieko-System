import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { DeliveryNote, Material, Site } from '@solar/shared';
import { enqueueOfflineAction } from '../services/storage';
import { PageIntro } from '../components/PageIntro';

interface Props {
  user: { id: string; full_name: string };
  site: Site;
  materialsCatalog: Material[];
  isOffline: boolean;
  locale?: 'ro' | 'en';
}

export function DeliveryIntakeScreen({ user, site, materialsCatalog, isOffline, locale = 'ro' }: Props) {
  const [avizNumber, setAvizNumber] = useState('AVZ-2026-');
  const [supplier, setSupplier] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState(materialsCatalog[0]?.id || 'm1');
  const [quantity, setQuantity] = useState('');
  const [hasPhoto, setHasPhoto] = useState(true); // Simulated document photo capture
  const [submitting, setSubmitting] = useState(false);

  const selectedMaterial = materialsCatalog.find(m => m.id === selectedMaterialId);

  const handleScanBarcode = () => {
    Alert.alert('Scanare Cod Bare', 'S-a scanat codul de bare: 5941234560012\nMaterial identificat: Panou Fotovoltaic 550W');
    setSelectedMaterialId(materialsCatalog[0]?.id || 'm1');
  };

  const handleCapturePhoto = () => {
    setHasPhoto(true);
    Alert.alert('Foto Aviz Capturată', 'Fotografia documentului de însoțire a mărfii a fost atașată recepției.');
  };

  const handleSubmit = async () => {
    if (!avizNumber.trim() || !supplier.trim() || !quantity) {
      Alert.alert('Eroare', 'Completează numărul avizului, furnizorul și cantitatea recepționată.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const deliveryNote: DeliveryNote = {
        id: `dn_${Date.now()}`,
        invoice_or_aviz_number: avizNumber.trim(),
        supplier: supplier.trim(),
        site_id: site.id,
        receiver_user_id: user.id,
        delivery_date: now.split('T')[0],
        photo_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        items: [
          {
            material_id: selectedMaterialId,
            material_code: selectedMaterial?.code || 'COD',
            material_name: selectedMaterial?.name || 'Material',
            unit: selectedMaterial?.unit || 'buc',
            quantity: Number(quantity),
          }
        ],
        notes: `Recepționat pe șantier de ${user.full_name}`,
        created_at: now,
        updated_at: now,
      };

      if (isOffline) {
        await enqueueOfflineAction('delivery_note_submit', deliveryNote as any);
        Alert.alert('Salvat Local (Offline)', 'Avizul a fost înregistrat offline. Stocul se va actualiza la sincronizare.');
      } else {
        Alert.alert('Recepție Finalizată!', `S-a adăugat +${quantity} ${selectedMaterial?.unit} la stocul șantierului.`);
      }

      setAvizNumber('AVZ-2026-');
      setSupplier('');
      setQuantity('');
    } catch (e: any) {
      Alert.alert('Eroare', e.message || 'Nu s-a putut salva avizul');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PageIntro sectionId="deliveries" locale={locale} role="team_leader" />
      <Text style={styles.title}>Recepție Materiale pe Șantier</Text>
      <Text style={styles.subtitle}>Fotografiază avizul și introdu cantitățile sosite de la furnizor.</Text>

      {/* Aviz Document Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. DATE DOCUMENT (AVIZ / FACTURĂ)</Text>
        
        <Text style={styles.inputLabel}>Număr Aviz / Factură:</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: AVZ-2026-9042"
          placeholderTextColor="#64748b"
          value={avizNumber}
          onChangeText={setAvizNumber}
        />

        <Text style={styles.inputLabel}>Furnizor / Distribuitor:</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Solar Distribution Romania SRL"
          placeholderTextColor="#64748b"
          value={supplier}
          onChangeText={setSupplier}
        />

        {/* Camera Photo Action */}
        <TouchableOpacity style={styles.photoButton} onPress={handleCapturePhoto}>
          <Text style={styles.photoButtonText}>
            {hasPhoto ? '✓ Foto Aviz Atașată (Re-fotografiază)' : '📷 FOTOGRAFIAZĂ AVIZUL'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Materials Intake Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. MATERIALE ȘI CODURI (SCANARE / SELECTARE)</Text>

        <TouchableOpacity style={styles.scanButton} onPress={handleScanBarcode}>
          <Text style={styles.scanButtonText}>🔍 SCANEAZĂ COD DE BARE / QR</Text>
        </TouchableOpacity>

        <Text style={styles.inputLabel}>Material Selectat:</Text>
        <View style={styles.materialSelectedBox}>
          <Text style={styles.materialSelectedText}>{selectedMaterial?.name}</Text>
          <Text style={styles.materialSelectedCode}>Cod: {selectedMaterial?.code} • Barcode: {selectedMaterial?.barcode}</Text>
        </View>

        <Text style={styles.inputLabel}>Cantitate Descărcată ({selectedMaterial?.unit}):</Text>
        <TextInput
          style={styles.input}
          placeholder={`Ex: 50 ${selectedMaterial?.unit}`}
          placeholderTextColor="#64748b"
          keyboardType="numeric"
          value={quantity}
          onChangeText={setQuantity}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity 
        style={styles.submitBtn} 
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.submitBtnText}>SALVEAZĂ RECEPȚIA ȘI CREȘTE STOCUL</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#0f172a',
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8', // Sky 400
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  photoButton: {
    backgroundColor: '#0284c7', // Sky 600
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  photoButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  scanButton: {
    backgroundColor: '#d97706', // Amber 600
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  materialSelectedBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  materialSelectedText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  materialSelectedCode: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  submitBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
