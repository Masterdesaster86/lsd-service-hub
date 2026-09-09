export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abwesenheiten: {
        Row: {
          art: string
          bemerkung: string | null
          bis: string
          id: string
          techniker_id: string
          von: string
        }
        Insert: {
          art: string
          bemerkung?: string | null
          bis: string
          id?: string
          techniker_id: string
          von: string
        }
        Update: {
          art?: string
          bemerkung?: string | null
          bis?: string
          id?: string
          techniker_id?: string
          von?: string
        }
        Relationships: [
          {
            foreignKeyName: "abwesenheiten_techniker_id_fkey"
            columns: ["techniker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ansprechpartner: {
        Row: {
          abteilung: string | null
          email: string | null
          id: string
          kunde_id: string
          name: string
          telefon: string | null
        }
        Insert: {
          abteilung?: string | null
          email?: string | null
          id?: string
          kunde_id: string
          name: string
          telefon?: string | null
        }
        Update: {
          abteilung?: string | null
          email?: string | null
          id?: string
          kunde_id?: string
          name?: string
          telefon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ansprechpartner_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bericht_nummer_counter: {
        Row: {
          aktueller_stand: number
          jahr: number
        }
        Insert: {
          aktueller_stand?: number
          jahr: number
        }
        Update: {
          aktueller_stand?: number
          jahr?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          name: string
          ort: string | null
          plz: string | null
          strasse: string | null
        }
        Insert: {
          id?: string
          name: string
          ort?: string | null
          plz?: string | null
          strasse?: string | null
        }
        Update: {
          id?: string
          name?: string
          ort?: string | null
          plz?: string | null
          strasse?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          aktiv: boolean
          auth_user_id: string | null
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          aktiv?: boolean
          auth_user_id?: string | null
          email: string
          id?: string
          name: string
          role: string
        }
        Update: {
          aktiv?: boolean
          auth_user_id?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      machine_arbeiten: {
        Row: {
          abgeschlossen_am: string | null
          abgeschlossen_von: string | null
          abschluss_text: string | null
          erstellt_am: string
          erstellt_von: string | null
          id: string
          maschine_id: string
          status: string
          text: string
        }
        Insert: {
          abgeschlossen_am?: string | null
          abgeschlossen_von?: string | null
          abschluss_text?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          maschine_id: string
          status?: string
          text: string
        }
        Update: {
          abgeschlossen_am?: string | null
          abgeschlossen_von?: string | null
          abschluss_text?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          maschine_id?: string
          status?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_arbeiten_abgeschlossen_von_fkey"
            columns: ["abgeschlossen_von"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_arbeiten_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_arbeiten_maschine_id_fkey"
            columns: ["maschine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_bilder: {
        Row: {
          created_at: string
          id: string
          maschine_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          maschine_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          maschine_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_bilder_maschine_id_fkey"
            columns: ["maschine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_notizen: {
        Row: {
          autor_id: string | null
          created_at: string
          id: string
          maschine_id: string
          text: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          id?: string
          maschine_id: string
          text: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          id?: string
          maschine_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_notizen_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_notizen_maschine_id_fkey"
            columns: ["maschine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          bezeichnung: string
          hersteller: string | null
          id: string
          kunde_id: string
          kunden_maschinennummer: string | null
          nummer: string | null
          steuerung: string | null
        }
        Insert: {
          bezeichnung: string
          hersteller?: string | null
          id?: string
          kunde_id: string
          kunden_maschinennummer?: string | null
          nummer?: string | null
          steuerung?: string | null
        }
        Update: {
          bezeichnung?: string
          hersteller?: string | null
          id?: string
          kunde_id?: string
          kunden_maschinennummer?: string | null
          nummer?: string | null
          steuerung?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_machines: {
        Row: {
          machine_id: string
          order_id: string
        }
        Insert: {
          machine_id: string
          order_id: string
        }
        Update: {
          machine_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_machines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_techniker: {
        Row: {
          order_id: string
          techniker_id: string
        }
        Insert: {
          order_id: string
          techniker_id: string
        }
        Update: {
          order_id?: string
          techniker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_techniker_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_techniker_techniker_id_fkey"
            columns: ["techniker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          ansprechpartner_id: string | null
          auftraggeber_id: string | null
          auftragsnr_kunde: string | null
          bestellnummer: string | null
          created_at: string
          dauer_tage: number
          einsatzbeginn: string | null
          einsatzkunde_id: string | null
          id: string
          kundenreferenznr: string | null
          meldetext: string | null
          status: string
        }
        Insert: {
          ansprechpartner_id?: string | null
          auftraggeber_id?: string | null
          auftragsnr_kunde?: string | null
          bestellnummer?: string | null
          created_at?: string
          dauer_tage?: number
          einsatzbeginn?: string | null
          einsatzkunde_id?: string | null
          id: string
          kundenreferenznr?: string | null
          meldetext?: string | null
          status?: string
        }
        Update: {
          ansprechpartner_id?: string | null
          auftraggeber_id?: string | null
          auftragsnr_kunde?: string | null
          bestellnummer?: string | null
          created_at?: string
          dauer_tage?: number
          einsatzbeginn?: string | null
          einsatzkunde_id?: string | null
          id?: string
          kundenreferenznr?: string | null
          meldetext?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_ansprechpartner_id_fkey"
            columns: ["ansprechpartner_id"]
            isOneToOne: false
            referencedRelation: "ansprechpartner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_auftraggeber_id_fkey"
            columns: ["auftraggeber_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_einsatzkunde_id_fkey"
            columns: ["einsatzkunde_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      servicebericht_ersatzteile: {
        Row: {
          bezeichnung: string
          id: string
          id_nummer: string | null
          menge: number
          servicebericht_id: string
        }
        Insert: {
          bezeichnung: string
          id?: string
          id_nummer?: string | null
          menge?: number
          servicebericht_id: string
        }
        Update: {
          bezeichnung?: string
          id?: string
          id_nummer?: string | null
          menge?: number
          servicebericht_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicebericht_ersatzteile_servicebericht_id_fkey"
            columns: ["servicebericht_id"]
            isOneToOne: false
            referencedRelation: "serviceberichte"
            referencedColumns: ["id"]
          },
        ]
      }
      servicebericht_tage: {
        Row: {
          arbeitsbeginn: string | null
          arbeitsende: string | null
          datum: string
          hinreise_von: string | null
          hotelkosten: number | null
          id: string
          km_hin: number | null
          km_rueck: number | null
          pause_bis: string | null
          pause_von: string | null
          rueckreise_bis: string | null
          servicebericht_id: string
          uebernachtung: boolean
        }
        Insert: {
          arbeitsbeginn?: string | null
          arbeitsende?: string | null
          datum: string
          hinreise_von?: string | null
          hotelkosten?: number | null
          id?: string
          km_hin?: number | null
          km_rueck?: number | null
          pause_bis?: string | null
          pause_von?: string | null
          rueckreise_bis?: string | null
          servicebericht_id: string
          uebernachtung?: boolean
        }
        Update: {
          arbeitsbeginn?: string | null
          arbeitsende?: string | null
          datum?: string
          hinreise_von?: string | null
          hotelkosten?: number | null
          id?: string
          km_hin?: number | null
          km_rueck?: number | null
          pause_bis?: string | null
          pause_von?: string | null
          rueckreise_bis?: string | null
          servicebericht_id?: string
          uebernachtung?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "servicebericht_tage_servicebericht_id_fkey"
            columns: ["servicebericht_id"]
            isOneToOne: false
            referencedRelation: "serviceberichte"
            referencedColumns: ["id"]
          },
        ]
      }
      serviceberichte: {
        Row: {
          abgerechnet: boolean
          abgerechnet_am: string | null
          abgeschlossen_am: string | null
          auftrag_id: string
          bericht_nummer: string
          betriebsstunden: number | null
          durchgefuehrte_arbeiten: string | null
          empfehlung: string | null
          fehlerbeschreibung: string | null
          id: string
          ist_nachtrag: boolean
          kunde_unterschrift_url: string | null
          maschine_id: string
          nachtrag_zu: string | null
          spindelstunden: number | null
          status: string
          techniker_id: string
          techniker_unterschrift_url: string | null
        }
        Insert: {
          abgerechnet?: boolean
          abgerechnet_am?: string | null
          abgeschlossen_am?: string | null
          auftrag_id: string
          bericht_nummer?: string
          betriebsstunden?: number | null
          durchgefuehrte_arbeiten?: string | null
          empfehlung?: string | null
          fehlerbeschreibung?: string | null
          id?: string
          ist_nachtrag?: boolean
          kunde_unterschrift_url?: string | null
          maschine_id: string
          nachtrag_zu?: string | null
          spindelstunden?: number | null
          status?: string
          techniker_id: string
          techniker_unterschrift_url?: string | null
        }
        Update: {
          abgerechnet?: boolean
          abgerechnet_am?: string | null
          abgeschlossen_am?: string | null
          auftrag_id?: string
          bericht_nummer?: string
          betriebsstunden?: number | null
          durchgefuehrte_arbeiten?: string | null
          empfehlung?: string | null
          fehlerbeschreibung?: string | null
          id?: string
          ist_nachtrag?: boolean
          kunde_unterschrift_url?: string | null
          maschine_id?: string
          nachtrag_zu?: string | null
          spindelstunden?: number | null
          status?: string
          techniker_id?: string
          techniker_unterschrift_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serviceberichte_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serviceberichte_maschine_id_fkey"
            columns: ["maschine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serviceberichte_nachtrag_zu_fkey"
            columns: ["nachtrag_zu"]
            isOneToOne: false
            referencedRelation: "serviceberichte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serviceberichte_techniker_id_fkey"
            columns: ["techniker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      urlaubsantraege: {
        Row: {
          beantragt_am: string
          bemerkung: string | null
          bis: string
          id: string
          status: string
          techniker_id: string
          von: string
        }
        Insert: {
          beantragt_am?: string
          bemerkung?: string | null
          bis: string
          id?: string
          status?: string
          techniker_id: string
          von: string
        }
        Update: {
          beantragt_am?: string
          bemerkung?: string | null
          bis?: string
          id?: string
          status?: string
          techniker_id?: string
          von?: string
        }
        Relationships: [
          {
            foreignKeyName: "urlaubsantraege_techniker_id_fkey"
            columns: ["techniker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bericht_ist_vollstaendig: {
        Args: { p_bericht_id: string }
        Returns: boolean
      }
      compute_order_status: { Args: { p_order_id: string }; Returns: string }
      current_employee: {
        Args: never
        Returns: {
          aktiv: boolean
          auth_user_id: string | null
          email: string
          id: string
          name: string
          role: string
        }
      }
      naechste_berichtnummer: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
