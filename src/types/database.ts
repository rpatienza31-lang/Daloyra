
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"business_id": string,"created_at": string,"id": string,"new_data": Json | null,"old_data": Json | null,"record_id": string,"table_name": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"new_data"?: Json | null,"old_data"?: Json | null,"record_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_counters": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"kind": string,"next_value": number,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"kind": string,"next_value"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"next_value"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_counters_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_members": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"role": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"role": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address": string | null,"business_type": string | null,"contact_number": string | null,"created_at": string,"created_by": string | null,"currency_code": string,"email": string | null,"id": string,"logo_path": string | null,"name": string,"owner_name": string | null,"starting_balance_date": string,"starting_cash_balance": number,"status": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"business_type"?: string | null,"contact_number"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency_code"?: string,"email"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"owner_name"?: string | null,"starting_balance_date"?: string,"starting_cash_balance"?: number,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"business_type"?: string | null,"contact_number"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency_code"?: string,"email"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"owner_name"?: string | null,"starting_balance_date"?: string,"starting_cash_balance"?: number,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customer_payments": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"created_by": string | null,"customer_id": string | null,"id": string,"method": string,"notes": string | null,"payment_date": string,"reference": string | null,"sale_id": string,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"id"?: string,"method"?: string,"notes"?: string | null,"payment_date": string,"reference"?: string | null,"sale_id": string,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"id"?: string,"method"?: string,"notes"?: string | null,"payment_date"?: string,"reference"?: string | null,"sale_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_payments_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_payments_business_id_sale_id_fkey"
      columns: ["business_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_payments_business_id_sale_id_fkey"
      columns: ["business_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales_overview"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"business_id": string,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "archived_at": string | null,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"is_default": boolean,"name": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "archived_at"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_default"?: boolean,"name": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_default"?: boolean,"name"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"limits": NonNullable<Json>,"name": string,"price_monthly": number,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name": string,"price_monthly"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name"?: string,"price_monthly"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sale_items": {
                  Row: {
                    "business_id": string,"created_at": string,"description": string,"id": string,"line_total": number | null,"position": number,"quantity": number,"sale_id": string,"unit_price": number,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"description": string,"id"?: string,"line_total"?: never,"position": number,"quantity": number,"sale_id": string,"unit_price": number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"line_total"?: never,"position"?: number,"quantity"?: number,"sale_id"?: string,"unit_price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_business_id_sale_id_fkey"
      columns: ["business_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "sale_items_business_id_sale_id_fkey"
      columns: ["business_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales_overview"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"customer_id": string | null,"discount_amount": number,"due_date": string | null,"id": string,"notes": string | null,"reference_no": string,"sale_date": string,"subtotal": number,"total": number | null,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_amount"?: number,"due_date"?: string | null,"id"?: string,"notes"?: string | null,"reference_no": string,"sale_date": string,"subtotal"?: number,"total"?: never,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"discount_amount"?: number,"due_date"?: string | null,"id"?: string,"notes"?: string | null,"reference_no"?: string,"sale_date"?: string,"subtotal"?: number,"total"?: never,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "sales_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "business_id": string,"created_at": string,"current_period_end": string | null,"id": string,"plan_id": string,"status": string,"trial_ends_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id": string,"status": string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id"?: string,"status"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"business_id": string,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "sales_overview": {
                  Row: {
                    "amount_paid": number | null,"balance": number | null,"business_id": string | null,"created_at": string | null,"created_by": string | null,"customer_id": string | null,"customer_name": string | null,"discount_amount": number | null,"due_date": string | null,"due_status": string | null,"id": string | null,"notes": string | null,"payment_status": string | null,"reference_no": string | null,"sale_date": string | null,"subtotal": number | null,"total": number | null,"void_reason": string | null,"voided_at": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "sales_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "create_business":
{ Args: { "p_address"?: string,"p_business_id": string,"p_business_type"?: string,"p_contact_number"?: string,"p_currency_code"?: string,"p_email"?: string,"p_name": string,"p_owner_name"?: string,"p_starting_cash_balance"?: string,"p_timezone"?: string }; Returns: string
                           },
"create_sale":
{ Args: { "p_business_id": string,"p_sale": Json }; Returns: string
                           },
"get_amount_to_collect":
{ Args: { "p_business_id": string,"p_customer_id"?: string }; Returns: string
                           },
"record_customer_payment":
{ Args: { "p_business_id": string,"p_payment": Json }; Returns: string
                           },
"update_business_settings":
{ Args: { "p_address": string,"p_business_id": string,"p_business_type": string,"p_contact_number": string,"p_currency_code": string,"p_email": string,"p_name": string,"p_owner_name": string,"p_starting_balance_date": string,"p_starting_cash_balance": string }; Returns: undefined
                           },
"update_sale":
{ Args: { "p_business_id": string,"p_sale": Json }; Returns: undefined
                           },
"void_customer_payment":
{ Args: { "p_business_id": string,"p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"void_sale":
{ Args: { "p_business_id": string,"p_reason": string,"p_sale_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
