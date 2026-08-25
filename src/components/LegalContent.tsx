// Shared layout for the legal pages (Impressum, Datenschutzerklärung) —
// consistent heading/paragraph rendering plus the draft-disclaimer banner
// every page needs, since neither is legally final as shipped.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadow, spacing, typography } from '../constants/theme';

export interface LegalSection {
  heading: string;
  body: string[]; // paragraphs
}

interface Props {
  title: string;
  sections: LegalSection[];
}

export default function LegalContent({ title, sections }: Props) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Draft — this page was generated to give the site basic legal-page coverage. The bracketed fields need
            your real business details, and it should be reviewed by a Rechtsanwalt before you rely on it as legally
            complete.
          </Text>
        </View>

        <Text style={typography.h1}>{title}</Text>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={typography.h3}>{section.heading}</Text>
            {section.body.map((paragraph, i) => (
              <Text key={i} style={[typography.bodyMuted, styles.paragraph]}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  disclaimer: {
    backgroundColor: 'rgba(182,85,64,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(182,85,64,0.3)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  disclaimerText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  paragraph: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
