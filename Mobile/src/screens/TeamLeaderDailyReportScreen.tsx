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
import { Material, Project } from '@solar/shared';
import { enqueueOperation, generateIdempotencyKey } from '../services/syncQueue';
import { apiClient } from '../services/apiClient';
import { PageIntro } from '../components/PageIntro';

const DRAFT_KEY = '@solar:daily_report_draft';

// Local form types for the team leader daily report screen (P4.2: separated from API types)
interface ProjectTask {
  id: string;
  title?: string;
  name?: string;
  code?: string;
  unit_of_measure?: string;
}

interface FormTask {
  taskId: string;
  description: string;
  quantity: number;
  unit: string;
}

interface FormMaterial {
  material_id: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
}

interface Props {
  leader: { id: string; full_name: string };
  project: Project;
  teamWorkers: { id: string; full_name: string }[];
  materialsCatalog: Material[];
  isOffline: boolean;
  locale?: 'ro' | 'en';
}

export function TeamLeaderDailyReportScreen({
  leader,
  project,
  teamWorkers,
  materialsCatalog,
  isOffline,
  locale = 'ro',
}: Props) {
  const [presentWorkerIds, setPresentWorkerIds] = useState<string[]>(teamWorkers.map(w => w.id));
  const [tasks, setTasks] = useState<FormTask[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskQty, setNewTaskQty] = useState('');
  
  const [materialsUsed, setMaterialsUsed] = useState<FormMaterial[]>([
    { material_id: materialsCatalog[0]?.id || 'm1', material_code: 'PAN-550W', material_name: 'Panou 550W', quantity: 3, unit: 'buc' }
  ]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load draft once. Existing drafts without task IDs are retained but cannot be submitted until each line is linked.
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

  // Load the real project task identities while online. Offline submission can still use task IDs stored in a draft.
  useEffect(() => {
    if (isOffline) return;

    let cancelled = false;
    async function loadProjectTasks() {
      setLoadingTasks(true);
      try {
        const response = await apiClient.getTasks(project.id);
        if (!cancelled) {
          setProjectTasks(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        console.error('Error loading project tasks:', err);
        if (!cancelled) {
          Alert.alert('Eroare', 'Nu s-au putut încărca lucrările proiectului. Poți păstra ciorna și reîncerca după reconectare.');
        }
      } finally {
        if (!cancelled) setLoadingTasks(false);
      }
    }

    loadProjectTasks();
    return () => {
      cancelled = true;
    };
  }, [isOffline, project.id]);

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
    const selectedTask = projectTasks.find(task => task.id === selectedTaskId);
    if (!selectedTask) {
      Alert.alert('Atenție', 'Selectează o lucrare reală din proiect.');
      return;
    }

    const description = selectedTask.title || selectedTask.name || selectedTask.code || 'Lucrare';
    const unit = selectedTask.unit_of_measure || 'buc';
    setTasks(prev => [...prev, {
      taskId: selectedTask.id,
      description,
      quantity: Number(newTaskQty) || 1,
      unit,
    }]);
    setSelectedTaskId('');
    setNewTaskQty('');
    setNewTaskDesc('');
  };

  const handleSubmit = async () => {
    if (tasks.length === 0) {
      Alert.alert('Atenție', 'Adaugă cel puțin o sarcină executată.');
      return;
    }

    const missingTaskId = tasks.some(task => !task.taskId);
    if (missingTaskId) {
      Alert.alert('Atenție', 'Fiecare lucrare din raport trebuie asociată unei lucrări reale din proiect. Deschide proiectul online și selectează lucrarea.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      
      // Map to backend CreateDailyReportDto format
      const reportPayload = {
        projectId: project.id,
        reportDate: now.split('T')[0],
        generalNotes: notes,
        // Map present workers (default 8 hours each)
        workers: presentWorkerIds.map(workerId => ({
          workerId,
          hoursWorked: 8,
          overtimeHours: 0,
        })),
        // Send the real backend task UUID, never free-text task descriptions.
        tasks: tasks.map(task => ({
          taskId: task.taskId,
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

      if (isOffline) {
        // Persist the queue item first. The draft is removed only after the queue write succeeds.
        await enqueueOperation('daily_report', 'create', reportPayload, idemKey);
        await AsyncStorage.removeItem(DRAFT_KEY);
        Alert.alert('Salvat Local (Offline)', 'Raportul zilnic al echipei a fost salvat pe telefon și se va transmite automat la reconectare.');
      } else {
        // Delete the local draft only after the server has accepted the report.
        await apiClient.createDailyReport(reportPayload, idemKey);
        await AsyncStorage.removeItem(DRAFT_KEY);
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
          <Text style={styles.subtitle}>Șantier: {project.name} • Șef Echipă: {leader.full_name}</Text>
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
            <View style={styles.taskDescription}>
              <Text style={styles.taskText}>• {t.description}</Text>
              <Text style={styles.taskIdText}>{t.taskId ? 'ID proiect asociat' : 'Lucrare neasociată — selectează o lucrare din proiect'}</Text>
            </View>
            <Text style={styles.taskQty}>{t.quantity} {t.unit}</Text>
          </View>
        ))}

        <View style={styles.projectTaskList}>
          <Text style={styles.taskPickerLabel}>
            {loadingTasks ? 'Se încarcă lucrările proiectului...' : 'Selectează lucrarea din proiect'}
          </Text>
          {projectTasks.map(task => {
            const label = task.title || task.name || task.code || task.id;
            const selected = selectedTaskId === task.id;
            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.projectTaskChip, selected && styles.projectTaskChipActive]}
                onPress={() => setSelectedTaskId(task.id)}
                disabled={loadingTasks}
              >
                <Text style={[styles.projectTaskText, selected && styles.projectTaskTextActive]}>
                  {task.code ? task.code + ' — ' : ''}{label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!loadingTasks && projectTasks.length === 0 && (
            <Text style={styles.noTasksText}>Nu există lucrări disponibile pentru acest proiect.</Text>
          )}
        </View>

        <View style={styles.addTaskBox}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Cantitate"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={newTaskQty}
            onChangeText={setNewTaskQty}
          />
          <TouchableOpacity style={styles.addButton} onPress={addTask} disabled={!selectedTaskId || loadingTasks}>
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
  taskDescription: {
    flex: 1,
    paddingRight: 8,
  },
  taskText: {
    color: '#f8fafc',
    fontSize: 13,
  },
  taskIdText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  taskPickerLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  projectTaskList: {
    marginTop: 10,
    gap: 6,
  },
  projectTaskChip: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  projectTaskChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  projectTaskText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  projectTaskTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  noTasksText: {
    color: '#94a3b8',
    fontSize: 11,
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
