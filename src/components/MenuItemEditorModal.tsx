// Add/edit form for a single dish, opened from the admin Menu tab. One
// component handles both add (item === null) and edit — same fields,
// upsert on save. Web-only (plain HTML file input for photo upload) since
// this whole project is a website, matching how other browser-only bits
// of the UI already skip the .web.tsx split.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminMenuItem, MenuItemInput, useStore } from '../context/StoreContext';
import { AddOn, Category } from '../data/menu';
import { colors, radii, spacing, typography } from '../constants/theme';

interface Props {
  visible: boolean;
  item: AdminMenuItem | null; // null = adding a new dish
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES: Category[] = ['Bowls', 'Drinks', 'Desserts'];
const REGIONS = ['asia', 'europe-africa', 'americas'] as const;

const FileInputEl = 'input' as unknown as React.ComponentType<
  React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }
>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const trimmed = text.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setText('');
  };
  return (
    <View>
      {values.length > 0 && (
        <View style={styles.chipRow}>
          {values.map((v) => (
            <Pressable key={v} style={styles.chip} onPress={() => onChange(values.filter((x) => x !== v))}>
              <Text style={styles.chipText}>{v} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          style={[styles.input, { flex: 1, marginTop: 0 }]}
          onSubmitEditing={add}
        />
        <Pressable style={styles.smallButton} onPress={add}>
          <Text style={styles.smallButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MenuItemEditorModal({ visible, item, onClose, onSaved }: Props) {
  const { upsertMenuItem, uploadDishPhoto } = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category>('Bowls');
  const [emoji, setEmoji] = useState('🍽️');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState('');
  const [proteinOptions, setProteinOptions] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState('');

  const [showOnGlobe, setShowOnGlobe] = useState(false);
  const [country, setCountry] = useState('');
  const [flag, setFlag] = useState('');
  const [landmark, setLandmark] = useState('');
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('europe-africa');
  const [lat, setLat] = useState('');
  const [long, setLong] = useState('');
  const [history, setHistory] = useState('');

  const [hasNutrition, setHasNutrition] = useState(false);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fiber, setFiber] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const [groupId, setGroupId] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (item) {
      setId(item.id);
      setName(item.name);
      setDescription(item.description);
      setPrice(String(item.price));
      setCategory(item.category);
      setEmoji(item.emoji);
      setImageUrl(item.imageUrl);
      setTags(item.tags ?? []);
      setAllergens(item.allergens ?? []);
      setIngredients(item.ingredients ?? '');
      setProteinOptions(item.proteinOptions ?? []);
      setAddOns(item.addOns ?? []);
      setShowOnGlobe(Boolean(item.origin));
      setCountry(item.origin?.country ?? '');
      setFlag(item.origin?.flag ?? '');
      setLandmark(item.origin?.landmark ?? '');
      setRegion(item.origin?.region ?? 'europe-africa');
      setLat(item.origin ? String(item.origin.lat) : '');
      setLong(item.origin ? String(item.origin.long) : '');
      setHistory(item.origin?.history ?? '');
      setHasNutrition(Boolean(item.nutrition));
      setCalories(item.nutrition ? String(item.nutrition.calories) : '');
      setProtein(item.nutrition ? String(item.nutrition.protein) : '');
      setFiber(item.nutrition ? String(item.nutrition.fiber) : '');
      setCarbs(item.nutrition ? String(item.nutrition.carbs) : '');
      setFat(item.nutrition ? String(item.nutrition.fat) : '');
      setGroupId(item.groupId ?? '');
      setGroupLabel(item.groupLabel ?? '');
      setIsActive(item.isActive);
    } else {
      setId('');
      setName('');
      setDescription('');
      setPrice('');
      setCategory('Bowls');
      setEmoji('🍽️');
      setImageUrl(null);
      setTags([]);
      setAllergens([]);
      setIngredients('');
      setProteinOptions([]);
      setAddOns([]);
      setShowOnGlobe(false);
      setCountry('');
      setFlag('');
      setLandmark('');
      setRegion('europe-africa');
      setLat('');
      setLong('');
      setHistory('');
      setHasNutrition(false);
      setCalories('');
      setProtein('');
      setFiber('');
      setCarbs('');
      setFat('');
      setGroupId('');
      setGroupLabel('');
      setIsActive(true);
    }
  }, [visible, item]);

  const addAddOn = () => {
    const trimmedName = newAddOnName.trim();
    const parsedPrice = Number(newAddOnPrice);
    if (!trimmedName || !Number.isFinite(parsedPrice)) return;
    setAddOns([...addOns, { id: slugify(trimmedName), name: trimmedName, price: parsedPrice }]);
    setNewAddOnName('');
    setNewAddOnPrice('');
  };

  const handleFileChange = (e: any) => {
    const file = e.target?.files?.[0] as File | undefined;
    if (!file) return;
    setUploading(true);
    uploadDishPhoto(file).then(({ url, error: uploadError }) => {
      setUploading(false);
      if (uploadError) {
        setError(uploadError);
        return;
      }
      setImageUrl(url);
    });
  };

  const handleSave = async () => {
    const finalId = item ? item.id : slugify(id || name);
    const parsedPrice = Number(price);
    if (!finalId || !name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Name and a valid price are required.');
      return;
    }
    if (showOnGlobe && (!country.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(long)))) {
      setError('Country, latitude and longitude are required to show this on the globe.');
      return;
    }

    const input: MenuItemInput = {
      id: finalId,
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      category,
      emoji: emoji.trim() || '🍽️',
      imageUrl,
      tags,
      allergens,
      ingredients: ingredients.trim() || null,
      proteinOptions: proteinOptions.length > 0 ? proteinOptions : null,
      addOns: addOns.length > 0 ? addOns : null,
      origin: showOnGlobe
        ? {
            country: country.trim(),
            flag: flag.trim(),
            landmark: landmark.trim(),
            region,
            lat: Number(lat),
            long: Number(long),
            history: history.trim(),
          }
        : null,
      nutrition: hasNutrition
        ? {
            calories: Number(calories) || 0,
            protein: Number(protein) || 0,
            fiber: Number(fiber) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
          }
        : null,
      groupId: groupId.trim() || null,
      groupLabel: groupLabel.trim() || null,
      isActive,
      sortOrder: item?.sortOrder ?? 999,
    };

    setSaving(true);
    setError(null);
    const { error: saveError } = await upsertMenuItem(input);
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={typography.h3}>{item ? 'Edit dish' : 'Add new dish'}</Text>

            <Text style={[typography.label, styles.fieldLabel]}>NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.inkMuted} />

            {!item && (
              <>
                <Text style={[typography.label, styles.fieldLabel]}>URL ID (auto from name if left blank)</Text>
                <TextInput
                  value={id}
                  onChangeText={setId}
                  placeholder={slugify(name) || 'my-new-dish'}
                  placeholderTextColor={colors.inkMuted}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            )}

            <Text style={[typography.label, styles.fieldLabel]}>DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, styles.multiline]}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, styles.fieldLabel]}>PRICE (€)</Text>
                <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.label, styles.fieldLabel]}>EMOJI</Text>
                <TextInput value={emoji} onChangeText={setEmoji} style={styles.input} />
              </View>
            </View>

            <Text style={[typography.label, styles.fieldLabel]}>CATEGORY</Text>
            <View style={styles.pillRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.pill, category === c && styles.pillActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.pillText, category === c && styles.pillTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[typography.label, styles.fieldLabel]}>PHOTO</Text>
            <View style={styles.photoRow}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </View>
              )}
              <View>
                <Pressable style={styles.smallButton} onPress={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Text style={styles.smallButtonText}>{uploading ? 'Uploading…' : 'Upload photo'}</Text>
                </Pressable>
                {imageUrl && (
                  <Pressable style={[styles.smallButton, styles.clearButton]} onPress={() => setImageUrl(null)}>
                    <Text style={styles.smallButtonText}>Remove photo</Text>
                  </Pressable>
                )}
                <FileInputEl
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </View>
            </View>

            <Text style={[typography.label, styles.fieldLabel]}>TAGS (e.g. Mild, Vegetarian)</Text>
            <ChipInput values={tags} onChange={setTags} placeholder="Add a tag" />

            <Text style={[typography.label, styles.fieldLabel]}>ALLERGENS</Text>
            <ChipInput values={allergens} onChange={setAllergens} placeholder="e.g. Gluten, Dairy, Peanut" />

            <Text style={[typography.label, styles.fieldLabel]}>INGREDIENTS (short description)</Text>
            <TextInput
              value={ingredients}
              onChangeText={setIngredients}
              multiline
              style={[styles.input, styles.multiline]}
            />

            <Text style={[typography.label, styles.fieldLabel]}>PROTEIN OPTIONS</Text>
            <ChipInput values={proteinOptions} onChange={setProteinOptions} placeholder="e.g. Chicken" />

            <Text style={[typography.label, styles.fieldLabel]}>ADD-ONS</Text>
            {addOns.length > 0 && (
              <View style={styles.addOnList}>
                {addOns.map((a) => (
                  <View key={a.id} style={styles.addOnRow}>
                    <Text style={[typography.body, { flex: 1 }]}>{a.name}</Text>
                    <Text style={typography.bodyMuted}>+€{a.price.toFixed(2)}</Text>
                    <Pressable onPress={() => setAddOns(addOns.filter((x) => x.id !== a.id))}>
                      <Text style={{ color: colors.danger, marginLeft: spacing.sm }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                value={newAddOnName}
                onChangeText={setNewAddOnName}
                placeholder="Add-on name"
                placeholderTextColor={colors.inkMuted}
                style={[styles.input, { flex: 2, marginTop: 0 }]}
              />
              <TextInput
                value={newAddOnPrice}
                onChangeText={setNewAddOnPrice}
                placeholder="€"
                placeholderTextColor={colors.inkMuted}
                keyboardType="numeric"
                style={[styles.input, { flex: 1, marginTop: 0 }]}
              />
              <Pressable style={styles.smallButton} onPress={addAddOn}>
                <Text style={styles.smallButtonText}>Add</Text>
              </Pressable>
            </View>

            <Pressable style={styles.toggleRow} onPress={() => setShowOnGlobe(!showOnGlobe)}>
              <View style={[styles.checkbox, showOnGlobe && styles.checkboxActive]}>
                {showOnGlobe && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={typography.body}>Show on the globe</Text>
            </Pressable>
            {showOnGlobe && (
              <View style={styles.subSection}>
                <View style={styles.row}>
                  <View style={{ flex: 2 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>COUNTRY</Text>
                    <TextInput value={country} onChangeText={setCountry} style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>FLAG</Text>
                    <TextInput value={flag} onChangeText={setFlag} style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>LANDMARK</Text>
                    <TextInput value={landmark} onChangeText={setLandmark} style={styles.input} />
                  </View>
                </View>
                <Text style={[typography.label, styles.fieldLabel]}>REGION</Text>
                <View style={styles.pillRow}>
                  {REGIONS.map((r) => (
                    <Pressable key={r} style={[styles.pill, region === r && styles.pillActive]} onPress={() => setRegion(r)}>
                      <Text style={[styles.pillText, region === r && styles.pillTextActive]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>LATITUDE</Text>
                    <TextInput value={lat} onChangeText={setLat} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>LONGITUDE</Text>
                    <TextInput value={long} onChangeText={setLong} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>
                <Text style={[typography.label, styles.fieldLabel]}>HISTORY / DID YOU KNOW</Text>
                <TextInput value={history} onChangeText={setHistory} multiline style={[styles.input, styles.multiline]} />
              </View>
            )}

            <Pressable style={styles.toggleRow} onPress={() => setHasNutrition(!hasNutrition)}>
              <View style={[styles.checkbox, hasNutrition && styles.checkboxActive]}>
                {hasNutrition && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={typography.body}>Show nutrition</Text>
            </Pressable>
            {hasNutrition && (
              <View style={styles.subSection}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>KCAL</Text>
                    <TextInput value={calories} onChangeText={setCalories} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>PROTEIN (g)</Text>
                    <TextInput value={protein} onChangeText={setProtein} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>FIBER (g)</Text>
                    <TextInput value={fiber} onChangeText={setFiber} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>CARBS (g)</Text>
                    <TextInput value={carbs} onChangeText={setCarbs} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, styles.fieldLabel]}>FAT (g)</Text>
                    <TextInput value={fat} onChangeText={setFat} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>
              </View>
            )}

            <Text style={[typography.label, styles.fieldLabel]}>SHARED STOP (e.g. a partner restaurant)</Text>
            <Text style={typography.bodyMuted}>
              Give two or more items the same group id to offer them as choices inside one globe pin's pop-out — only the
              item with globe coordinates above gets the pin itself.
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput value={groupId} onChangeText={setGroupId} placeholder="group id" placeholderTextColor={colors.inkMuted} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={groupLabel}
                  onChangeText={setGroupLabel}
                  placeholder="Shown label"
                  placeholderTextColor={colors.inkMuted}
                  style={styles.input}
                />
              </View>
            </View>

            <Pressable style={styles.toggleRow} onPress={() => setIsActive(!isActive)}>
              <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                {isActive && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={typography.body}>Visible to customers</Text>
            </Pressable>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.footerRow}>
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save dish</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetContent: {
    padding: spacing.lg,
  },
  fieldLabel: {
    marginTop: spacing.md,
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
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    alignItems: 'flex-start',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cream,
  },
  pillActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  pillTextActive: {
    color: colors.white,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  smallButton: {
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.danger,
  },
  smallButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  addOnList: {
    marginTop: spacing.xs,
  },
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  subSection: {
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontWeight: '700',
    color: colors.inkMuted,
  },
  saveButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.forest,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
