/**
 * Politique de confidentialité — Salle
 * Requise par Apple (App Store Review Guidelines §5.1.1)
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

const LAST_UPDATED = '24 mai 2026';
const CONTACT_EMAIL = 'privacy@salle-app.com';
const APP_NAME = 'Salle';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>;
}
function Section({ title, children, colors }: SectionProps) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

interface ParaProps {
  text: string;
  colors: ReturnType<typeof useTheme>;
}
function Para({ text, colors }: ParaProps) {
  return (
    <Text style={{ fontSize: 14, color: colors.text2, lineHeight: 22, marginBottom: 8 }}>
      {text}
    </Text>
  );
}

interface BulletProps {
  items: string[];
  colors: ReturnType<typeof useTheme>;
}
function Bullets({ items, colors }: BulletProps) {
  return (
    <View style={{ gap: 6, marginBottom: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: colors.accent, fontSize: 14, lineHeight: 22 }}>•</Text>
          <Text style={{ flex: 1, fontSize: 14, color: colors.text2, lineHeight: 22 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const colors = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/settings' as any)}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }}>
          Politique de confidentialité
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      >
        <Text style={{ fontSize: 12, color: colors.mute, marginBottom: 24 }}>
          Dernière mise à jour : {LAST_UPDATED}
        </Text>

        <Section title="1. Introduction" colors={colors}>
          <Para
            text={`${APP_NAME} (« nous », « notre ») s'engage à protéger ta vie privée. Cette politique explique quelles données nous collectons lorsque tu utilises notre application mobile, comment nous les utilisons et quels droits tu as sur ces données.`}
            colors={colors}
          />
          <Para
            text="En utilisant Salle, tu acceptes les pratiques décrites dans cette politique."
            colors={colors}
          />
        </Section>

        <Section title="2. Données collectées" colors={colors}>
          <Para text="Nous collectons les données suivantes :" colors={colors} />
          <Bullets
            colors={colors}
            items={[
              'Informations de compte : adresse e-mail, nom d\'utilisateur, mot de passe (haché).',
              'Profil fitness : prénom, poids, taille, date de naissance, sexe, objectif, niveau.',
              'Données d\'entraînement : séances, exercices, séries, poids soulevés, durées.',
              'Suivi quotidien : calories, macros, poids corporel, hydratation, pas, cardio.',
              'Photos de progression : photos prises ou importées depuis ta galerie (stockées de manière privée).',
              'Données techniques : logs d\'utilisation, rapports de crash, préférences de l\'app.',
            ]}
          />
        </Section>

        <Section title="3. Comment nous utilisons tes données" colors={colors}>
          <Para text="Tes données sont utilisées pour :" colors={colors} />
          <Bullets
            colors={colors}
            items={[
              'Faire fonctionner et améliorer l\'application.',
              'Calculer tes objectifs nutritionnels personnalisés (TDEE, macros).',
              'Afficher ta progression et tes statistiques.',
              'Envoyer des rappels de séances (uniquement si activés).',
              'Générer des programmes via IA (le texte de ta demande est envoyé à un service tiers — aucune donnée personnelle identifiable n\'est transmise).',
              'Respecter nos obligations légales.',
            ]}
          />
        </Section>

        <Section title="4. Partage des données" colors={colors}>
          <Para
            text="Nous ne vendons jamais tes données personnelles. Nous partageons des données uniquement avec :"
            colors={colors}
          />
          <Bullets
            colors={colors}
            items={[
              'Supabase (infrastructure back-end, hébergée en Europe/US) — base de données, authentification et stockage.',
              'Groq / modèles LLM (uniquement pour la génération de programme IA — aucune donnée personnelle identifiable transmise).',
              'Apple (App Store, statistiques de crash anonymisées via Xcode).',
              'Autorités légales si requis par la loi.',
            ]}
          />
        </Section>

        <Section title="5. Stockage et sécurité" colors={colors}>
          <Para
            text="Tes données sont stockées sur des serveurs sécurisés (Supabase). Les photos sont stockées dans un bucket privé accessible uniquement via des URL signées temporaires. Les mots de passe sont hachés côté serveur et ne sont jamais accessibles en clair."
            colors={colors}
          />
          <Para
            text="Toutes les communications entre l'app et nos serveurs sont chiffrées via HTTPS/TLS."
            colors={colors}
          />
        </Section>

        <Section title="6. Conservation des données" colors={colors}>
          <Para
            text="Tes données sont conservées tant que ton compte est actif. Si tu supprimes ton compte, toutes tes données personnelles sont effacées définitivement dans un délai de 30 jours. Les sauvegardes anonymisées peuvent être conservées jusqu'à 90 jours."
            colors={colors}
          />
        </Section>

        <Section title="7. Tes droits" colors={colors}>
          <Para text="Conformément au RGPD, tu as le droit de :" colors={colors} />
          <Bullets
            colors={colors}
            items={[
              'Accéder à tes données (export disponible dans Paramètres > Exporter mes données).',
              'Rectifier tes informations (depuis Paramètres > Modifier le profil).',
              'Effacer ton compte et toutes tes données (depuis Paramètres > Supprimer mon compte).',
              'T\'opposer au traitement de tes données.',
              'Obtenir la portabilité de tes données.',
            ]}
          />
          <Para
            text={`Pour exercer ces droits ou pour toute question, contacte-nous à : ${CONTACT_EMAIL}`}
            colors={colors}
          />
        </Section>

        <Section title="8. Mineurs" colors={colors}>
          <Para
            text="Salle n'est pas destinée aux enfants de moins de 13 ans. Nous ne collectons pas sciemment des données de mineurs de moins de 13 ans. Si tu es parent et penses que ton enfant nous a fourni des données, contacte-nous."
            colors={colors}
          />
        </Section>

        <Section title="9. Cookies et traceurs" colors={colors}>
          <Para
            text="L'application mobile n'utilise pas de cookies publicitaires. Nous utilisons uniquement le stockage local (AsyncStorage, SecureStore) pour maintenir ta session et tes préférences."
            colors={colors}
          />
        </Section>

        <Section title="10. Modifications de cette politique" colors={colors}>
          <Para
            text="Nous pouvons mettre à jour cette politique de temps à autre. En cas de changement important, tu seras notifié dans l'application. La date de dernière mise à jour est indiquée en haut de ce document."
            colors={colors}
          />
        </Section>

        <Section title="11. Contact" colors={colors}>
          <Para
            text={`Pour toute question relative à cette politique de confidentialité :\n\nEmail : ${CONTACT_EMAIL}\n\nNous répondrons dans un délai de 30 jours.`}
            colors={colors}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
