/**
 * Conditions d'utilisation — Salle
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

const LAST_UPDATED = '24 mai 2026';
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

function Para({ text, colors }: { text: string; colors: ReturnType<typeof useTheme> }) {
  return (
    <Text style={{ fontSize: 14, color: colors.text2, lineHeight: 22, marginBottom: 8 }}>
      {text}
    </Text>
  );
}

export default function TermsScreen() {
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
          Conditions d'utilisation
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      >
        <Text style={{ fontSize: 12, color: colors.mute, marginBottom: 24 }}>
          Dernière mise à jour : {LAST_UPDATED}
        </Text>

        <Section title="1. Acceptation des conditions" colors={colors}>
          <Para
            text={`En téléchargeant et en utilisant ${APP_NAME}, tu acceptes ces conditions d'utilisation dans leur intégralité. Si tu n'acceptes pas ces conditions, tu ne dois pas utiliser l'application.`}
            colors={colors}
          />
        </Section>

        <Section title="2. Description du service" colors={colors}>
          <Para
            text={`${APP_NAME} est une application mobile de suivi fitness qui te permet de créer et suivre des programmes d'entraînement, d'enregistrer tes séances, de suivre ta nutrition et ta progression physique.`}
            colors={colors}
          />
          <Para
            text="L'application propose également une fonctionnalité de génération de programme par intelligence artificielle (IA) à titre indicatif uniquement."
            colors={colors}
          />
        </Section>

        <Section title="3. Avertissement médical" colors={colors}>
          <Para
            text="IMPORTANT : Salle n'est pas un dispositif médical. Les informations et recommandations fournies (calcul du TDEE, programmes d'entraînement, conseils nutritionnels) sont données à titre informatif uniquement et ne constituent pas des conseils médicaux."
            colors={colors}
          />
          <Para
            text="Consulte un médecin avant de commencer tout nouveau programme d'exercice, particulièrement si tu as des problèmes de santé, une blessure, ou si tu es enceinte. Nous déclinons toute responsabilité en cas de blessure ou problème de santé résultant de l'utilisation de l'application."
            colors={colors}
          />
        </Section>

        <Section title="4. Compte utilisateur" colors={colors}>
          <Para
            text="Tu dois avoir au moins 13 ans pour créer un compte. Tu es responsable de la confidentialité de tes identifiants de connexion et de toutes les activités effectuées sous ton compte."
            colors={colors}
          />
          <Para
            text="Tu t'engages à fournir des informations exactes et à maintenir ton compte à jour."
            colors={colors}
          />
        </Section>

        <Section title="5. Utilisation acceptable" colors={colors}>
          <Para text="Tu t'engages à ne pas :" colors={colors} />
          <Para
            text="— Utiliser l'application à des fins illicites ou frauduleuses.\n— Tenter d'accéder aux données d'autres utilisateurs.\n— Transmettre des contenus offensants, illégaux ou malveillants.\n— Ingénierie inverse, décompiler ou modifier l'application.\n— Utiliser l'application de manière à la perturber ou à nuire à d'autres utilisateurs."
            colors={colors}
          />
        </Section>

        <Section title="6. Propriété intellectuelle" colors={colors}>
          <Para
            text={`Tous les droits de propriété intellectuelle relatifs à ${APP_NAME} (code, design, logo, contenu) sont la propriété exclusive de ses créateurs. Aucun droit n'est cédé à l'utilisateur au-delà du droit d'utilisation personnel et non commercial de l'application.`}
            colors={colors}
          />
        </Section>

        <Section title="7. Contenu généré par l'utilisateur" colors={colors}>
          <Para
            text="Les photos et données que tu enregistres restent ta propriété. En les téléchargeant, tu nous accordes une licence limitée pour les stocker et les afficher dans le cadre du service. Nous ne partageons jamais tes photos avec des tiers."
            colors={colors}
          />
        </Section>

        <Section title="8. Limitation de responsabilité" colors={colors}>
          <Para
            text={`Dans les limites permises par la loi, ${APP_NAME} et ses développeurs ne peuvent être tenus responsables des dommages directs, indirects, accessoires ou consécutifs résultant de l'utilisation ou de l'impossibilité d'utiliser l'application.`}
            colors={colors}
          />
        </Section>

        <Section title="9. Suspension et résiliation" colors={colors}>
          <Para
            text="Nous nous réservons le droit de suspendre ou supprimer tout compte qui violerait ces conditions d'utilisation, sans préavis."
            colors={colors}
          />
          <Para
            text="Tu peux supprimer ton compte à tout moment depuis Paramètres > Supprimer mon compte."
            colors={colors}
          />
        </Section>

        <Section title="10. Modifications" colors={colors}>
          <Para
            text="Nous pouvons modifier ces conditions à tout moment. Les modifications importantes seront notifiées dans l'application. L'utilisation continue de l'application après modification constitue une acceptation des nouvelles conditions."
            colors={colors}
          />
        </Section>

        <Section title="11. Droit applicable" colors={colors}>
          <Para
            text="Ces conditions sont régies par le droit français. Tout litige sera soumis à la juridiction des tribunaux français compétents."
            colors={colors}
          />
        </Section>

        <Section title="12. Contact" colors={colors}>
          <Para
            text="Pour toute question concernant ces conditions : contact@salle-app.com"
            colors={colors}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
