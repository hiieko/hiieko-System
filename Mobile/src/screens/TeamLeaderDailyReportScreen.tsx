import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyReport, DailyReportTask, DailyReportMaterialUsage, Material, Site } from '@solar/shared';
import { enqueueOperation, generateIdempotencyKey } from '../services/syncQueue';
import { apiClient } from '../services/apiClient';
import { PageIntro } from '../components/PageIntro';

const DRAFT_KEY = '@solar:daily_report_draft';

interface Props {
  leader: { id: string; full_name: string };
  site: Site;
  teamWorkers: { id: string; full_name: string }[];
  materialsCatalog: Material[];
  isOffline: boolean;
  locale?: 'ro' | 'en';
}

export function TeamLeaderDailyReportScreen({
  leader,
  site,
  teamWorkers,
  materialsCatalog,
  isOffline,
  locale = 'ro',
}: Props) {
  const [presentWorkerIds, setPresentWorkerIds] = useState<string[]>(teamWorkers.map(w => w.id));
  const [tasks, setTasks] = useState<DailyReportTask[]>([
    { description: 'Montat panouri fotovoltaice', quantity: 3, unit: 'buc' },
    { description: 'Montat cabluri (stringuri)', quantity: 7, unit: 'cabluri' },
  ]);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskQty, setNewTaskQty] = useState('');
  
  const [materialsUsed, setMaterialsUsed] = useState<DailyReportMaterialUsage[]>([
    { material_id: materialsCatalog[0]?.id || 'm1', material_code: 'PAN-550W', material_name: 'Panou 550W', quantity: 3, unit: 'buc' }
  ]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.presentWorkerIds) setPresentWorkerIds(draft.presentWorkerIds);
          if (draft.tasks) setTasks(draft.tasks);
          if (draft.materialsUsed) setMaterialsUsed(draft.materialsUsed);
          if (draft.notes) setNotes(draft.notes);
        }
      } catch (err) {
        console.error('Error loading draft:', err);
      }
    }
    loadDraft();
  }, []);

  const saveDraft = async () => {
    try {
      const draftData = {
        presentWorkerIds,
        tasks,
        materialsUsed,
        notes,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      Alert.alert('Ciornă Salvată', 'Raportul a fost salvat ca ciornă pe dispozitiv.');
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva ciorna');
    }
  };

  const toggleWorker = (id: string) => {
    setPresentWorkerIds(prev => 
      prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
    );
  };

  const addTask = () => {
    if (!newTaskDesc.trim()) return;
    setTasks(prev => [...prev, { description: newTaskDesc.trim(), quantity: Number(newTaskQty) || 1, unit: 'buc' }]);
    setNewTaskDesc('');
    setNewTaskQty('');
  };

  const handleSubmit = async () => {
    if (tasks.length === 0) {
      Alert.alert('Atenție', 'Adaugă cel puțin o sarcină executată.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      
      // Map to backend CreateDailyReportDto format
      const reportPayload = {
        projectId: site.id,
        reportDate: now.split('T')[0],
        generalNotes: notes,
        // Map present workers (default 8 hours each)
        workers: presentWorkerIds.map(workerId => ({
          workerId,
          hoursWorked: 8,
          overtimeHours: 0,
        })),
        // Map tasks (use description as identifier)
        tasks: tasks.map((task, idx) => ({
          taskId: task.description.substring(0, 50) || `task_${idx}`,
          quantityDone: task.quantity,
          notes: task.description,
        })),
        // Map materials used
        materials: materialsUsed.map(m => ({
          materialId: m.material_id,
          quantityUsed: m.quantity,
        })),
      };
      const idemKey = generateIdempotencyKey('daily_report', 'create');

      await AsyncStorage.removeItem(DRAFT_KEY);

      if (isOffline) {
        // Enqueue for later sync (SQLite-based queue)
        await enqueueOperation('daily_report', 'create', reportPayload, idemKey);
        Alert.alert('Salvat Local (Offline)', 'Raportul zilnic al echipei a fost salvat pe telefon și se va transmite automat la reconectare.');
      } else {
        // Submit directly to API
        await apiClient.createDailyReport(reportPayload, idemKey);
        Alert.alert('Raport Transmis!', 'Raportul zilnic a fost trimis cu succes către Manager.');
      }
    } catch (e: any) {
      console.error('Daily report submit error:', e);
      Alert.alert('Eroare', e.message || 'Nu s-a putut transmite raportul');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PageIntro sectionId="reports" locale={locale} role="team_leader" />
      <View style={styles.topHeaderRow}>
        <View>
          <Text style={styles.title}>Raport Zilnic per Echipă</Text>
          <Text style={styles.subtitle}>Șantier: {site.name} • Șef Echipă: {leader.full_name}</Text>
        </View>
        <TouchableOpacity style={styles.draftBtn} onPress={saveDraft}>
          <Text style={styles.draftBtnText}>Salvează Ciornă</Text>
        </TouchableOpacity>
      </View>

      {/* 1. Workers Present */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. ECHIPA CARE A LUCRAT AZI</Text>
        <View style={styles.workerList}>
          {teamWorkers.map(w => {
            const isChecked = presentWorkerIds.includes(w.id);
            return (
              <TouchableOpacity
                key={w.id}
                style={[styles.workerChip, isChecked && styles.workerChipActive]}
                onPress={() => toggleWorker(w.id)}
              >
                <Text style={[styles.workerChipText, isChecked && styles.workerChipTextActive]}>
                  {isChecked ? '✓ ' : '+ '} {w.full_name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Tasks Done */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. LUCRĂRI EXECUTATE (EX: MONTAT 3 PANOURI)</Text>
        {tasks.map((t, idx) => (
          <View key={idx} style={styles.taskRow}>
            <Text style={styles.taskText}>• {t.description}</Text>
            <Text style={styles.taskQty}>{t.quantity} {t.unit}</Text>
          </View>
        ))}

        <View style={styles.addTaskBox}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Descriere lucrare..."
            placeholderTextColor="#64748b"
            value={newTaskDesc}
            onChangeText={setNewTaskDesc}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Cantitate"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={newTaskQty}
            onChangeText={setNewTaskQty}
          />
          <TouchableOpacity style={styles.addButton} onPress={addTask}>
            <Text style={styles.addButtonText}>+ Adaugă</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Materials Consumed */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. MATERIALE UTILIZATE DIN STOC</Text>
        {materialsUsed.map((m, idx) => (
          <View key={idx} style={styles.taskRow}>
            <Text style={styles.taskText}>{m.material_name} ({m.material_code})</Text>
            <Text style={styles.materialQty}>-{m.quantity} {m.unit}</Text>
          </View>
        ))}
      </View>

      {/* 4. Notes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>4. OBSERVAȚII ȘI PROBLEME ÎNTÂMPINATE</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={3}
          placeholder="Scrie detalii despre stadiul lucrărilor..."
          placeholderTextColor="#64748b"
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity 
        style={styles.submitBtn} 
        onPress={handleSubmit} 
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.submitBtnText}>TRANSMITE RAPORTUL ZILNIC</Text>
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
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  },
  draftBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  draftBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
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
    color: '#f59e0b',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  workerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workerChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  workerChipActive: {
    backgroundColor: '#10b981',
  },
  workerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  workerChipTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  taskText: {
    color: '#f8fafc',
    fontSize: 13,
  },
  taskQty: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 13,
  },
  materialQty: {
    color: '#f43f5e',
    fontWeight: '700',
    fontSize: 13,
  },
  addTaskBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
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
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
