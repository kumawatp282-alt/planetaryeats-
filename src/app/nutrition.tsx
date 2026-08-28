// Personal daily intake tracker. Counts what the customer ordered from
// Planetary Eats automatically, and lets them log anything else they ate
// so the day's total is actually complete. Entirely private to the
// signed-in user (RLS-scoped) — the business never sees this data.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { NutritionGoals, useStore, useTodayNutrition } from '../context/StoreContext';
import AuthForm from '../components/AuthForm';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';

function ProgressBar({ value, goal, color }: { value: number; goal: number | null; color: string }) {
  if (!goal || goal <= 0) return null;
  const pct = Math.min(100, (value / goal) * 100);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function NutritionScreen() {
  const { user, loading: authLoading } = useAuth();
  const { addNutritionEntry, deleteNutritionEntry, updateNutritionGoals } = useStore();
  const { iso, loading: nutritionLoading, entries, goals, orderTotals, totalToday: total, refresh } =
    useTodayNutrition();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalCalories, setGoalCalories] = useState('');
  const [goalProtein, setGoalProtein] = useState('');

  const [label, setLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fiber, setFiber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGoalCalories(goals.calories ? String(goals.calories) : '');
    setGoalProtein(goals.protein ? String(goals.protein) : '');
  }, [goals]);

  const addEntry = async () => {
    const trimmed = label.trim();
    const kcal = Number(calories);
    if (!trimmed || !Number.isFinite(kcal) || kcal < 0) {
      setError('Give it a name and a calorie number.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: addError } = await addNutritionEntry(iso, {
      label: trimmed,
      calories: kcal,
      protein: Number(protein) || 0,
      fiber: Number(fiber) || 0,
    });
    setSaving(false);
    if (addError) {
      setError(addError);
      return;
    }
    setLabel('');
    setCalories('');
    setProtein('');
    setFiber('');
    refresh();
  };

  const removeEntry = async (id: string) => {
    await deleteNutritionEntry(id);
    refresh();
  };

  const saveGoals = async () => {
    const nextGoals: NutritionGoals = {
      calories: goalCalories.trim() ? Number(goalCalories) : null,
      protein: goalProtein.trim() ? Number(goalProtein) : null,
    };
    if (
      (nextGoals.calories !== null && (!Number.isFinite(nextGoals.calories) || nextGoals.calories <= 0)) ||
      (nextGoals.protein !== null && (!Number.isFinite(nextGoals.protein) || nextGoals.protein <= 0))
    ) {
      setError('Enter valid numbers for your targets, or leave them blank.');
      return;
    }
    await updateNutritionGoals(nextGoals);
    refresh();
    setShowGoalForm(false);
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.screen}>
        <AuthForm helperText="Sign in to keep track of what you've eaten today." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.h1}>Today</Text>
      <Text style={[typography.bodyMuted, { marginTop: 2 }]}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>

      <View style={styles.totalCard}>
        <Text style={styles.bigNumber}>{Math.round(total.calories)}</Text>
        <Text style={styles.bigLabel}>
          kcal{goals.calories ? ` of ${goals.calories}` : ''}
        </Text>
        <ProgressBar value={total.calories} goal={goals.calories} color={colors.forest} />

        <View style={styles.macroRow}>
          <View style={styles.macroCell}>
            <Text style={styles.macroValue}>{Math.round(total.protein)}g</Text>
            <Text style={styles.macroLabel}>protein{goals.protein ? ` / ${goals.protein}g` : ''}</Text>
            <ProgressBar value={total.protein} goal={goals.protein} color={colors.clay} />
          </View>
          <View style={styles.macroCell}>
            <Text style={styles.macroValue}>{Math.round(total.fiber)}g</Text>
            <Text style={styles.macroLabel}>fiber</Text>
          </View>
        </View>

        <Pressable onPress={() => setShowGoalForm(!showGoalForm)}>
          <Text style={styles.goalLink}>{goals.calories ? 'Change daily target' : 'Set a daily target'}</Text>
        </Pressable>
      </View>

      {showGoalForm && (
        <View style={styles.card}>
          <Text style={typography.label}>YOUR DAILY TARGET</Text>
          <Text style={[typography.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
            Whatever number you want to track against — leave blank for none. We don't calculate this for you;
            what's right for you is a question for you or a doctor/dietitian, not a website.
          </Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { marginTop: spacing.sm }]}>CALORIES</Text>
              <TextInput
                value={goalCalories}
                onChangeText={setGoalCalories}
                keyboardType="numeric"
                placeholder="e.g. 2000"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { marginTop: spacing.sm }]}>PROTEIN (g)</Text>
              <TextInput
                value={goalProtein}
                onChangeText={setGoalProtein}
                keyboardType="numeric"
                placeholder="e.g. 90"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={saveGoals}>
            <Text style={styles.primaryButtonText}>Save target</Text>
          </Pressable>
        </View>
      )}

      <Text style={[typography.label, { marginTop: spacing.lg }]}>FROM YOUR ORDERS</Text>
      <View style={styles.card}>
        {orderTotals.calories === 0 ? (
          <Text style={typography.bodyMuted}>Nothing ordered from Planetary Eats today yet.</Text>
        ) : (
          <View style={styles.entryRow}>
            <Text style={[typography.body, { flex: 1 }]}>Planetary Eats orders</Text>
            <Text style={typography.bodyMuted}>{Math.round(orderTotals.calories)} kcal</Text>
          </View>
        )}
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg }]}>ANYTHING ELSE YOU ATE</Text>
      {nutritionLoading ? (
        <ActivityIndicator color={colors.forest} style={{ marginTop: spacing.md }} />
      ) : (
        <View style={styles.card}>
          {entries.length === 0 && (
            <Text style={typography.bodyMuted}>Nothing logged yet. Add breakfast, snacks, meals elsewhere…</Text>
          )}
          {entries.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{e.label}</Text>
                <Text style={[typography.bodyMuted, { fontSize: 11 }]}>
                  {Math.round(e.calories)} kcal
                  {e.protein ? ` · ${Math.round(e.protein)}g protein` : ''}
                  {e.fiber ? ` · ${Math.round(e.fiber)}g fiber` : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeEntry(e.id)} hitSlop={10}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={typography.label}>ADD SOMETHING</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="What did you eat?"
          placeholderTextColor={colors.inkMuted}
          style={styles.input}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { marginTop: spacing.sm }]}>KCAL</Text>
            <TextInput
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { marginTop: spacing.sm }]}>PROTEIN (g)</Text>
            <TextInput
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { marginTop: spacing.sm }]}>FIBER (g)</Text>
            <TextInput
              value={fiber}
              onChangeText={setFiber}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
          </View>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Pressable style={styles.primaryButton} onPress={addEntry} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Adding…' : 'Add to today'}</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>
        Figures for our bowls are estimates, not lab-verified, and anything you add here is whatever you enter. This
        is a rough tracker to help you notice patterns — it isn't medical or nutritional advice. Only you can see it.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing.xxl,
  },
  totalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.forest,
    fontFamily: 'Fraunces, Georgia, serif',
  },
  bigLabel: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: -4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cream,
    width: '100%',
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    width: '100%',
  },
  macroCell: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  macroLabel: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  goalLink: {
    marginTop: spacing.md,
    color: colors.leaf,
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    marginTop: spacing.xs,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  removeText: {
    color: colors.danger,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  footnote: {
    marginTop: spacing.lg,
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 17,
    textAlign: 'center',
  },
});
