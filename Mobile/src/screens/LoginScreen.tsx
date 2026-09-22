import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { login } from '../services/auth';

interface Props { 
  onLogin: (user: { id: string; full_name: string; role: string }) => void; 
}

export function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { 
      Alert.alert('Eroare', 'Completează email și parolă.'); 
      return; 
    }
    
    setLoading(true);
    
    try {
      const user = await login(email, password);
      
      // Successful login
      onLogin({
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      });
      
    } catch (err: any) {
      console.error('Login error:', err);
      Alert.alert(
        'Eroare autentificare', 
        err.message || 'Email sau parolă incorectă.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.logo}><Text style={s.logoText}>H</Text></View>
      <Text style={s.title}>HIIEKO Solar Manager</Text>
      <Text style={s.sub}>Autentificare în aplicație</Text>
      <View style={s.form}>
        <Text style={s.label}>Email</Text>
        <TextInput 
          style={s.input} 
          value={email} 
          onChangeText={setEmail} 
          placeholder="nume@companie.ro" 
          placeholderTextColor="#64748b" 
          keyboardType="email-address" 
          autoCapitalize="none"
          editable={!loading}
        />
        <Text style={s.label}>Parolă</Text>
        <TextInput 
          style={s.input} 
          value={password} 
          onChangeText={setPassword} 
          placeholder="Parolă" 
          placeholderTextColor="#64748b" 
          secureTextEntry
          editable={!loading}
        />
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={s.btnText}>CONECTARE</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontSize: 32, fontWeight: '900', color: '#0f172a' },
  title: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  sub: { fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 32 },
  form: { width: '100%', gap: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#ffffff', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  btn: { backgroundColor: '#f59e0b', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0f172a', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
});

