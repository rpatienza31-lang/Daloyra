
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
                },"cash_adjustments": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"created_by": string | null,"direction": string,"entry_date": string,"id": string,"method": string,"notes": string | null,"type": string,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"direction": string,"entry_date": string,"id"?: string,"method"?: string,"notes"?: string | null,"type": string,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"direction"?: string,"entry_date"?: string,"id"?: string,"method"?: string,"notes"?: string | null,"type"?: string,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_adjustments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
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
      referencedRelation: "customer_summary"
      referencedColumns: ["business_id","customer_id"]
    },{
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
                },"expenses": {
                  Row: {
                    "amount": number,"business_id": string,"category_id": string,"created_at": string,"created_by": string | null,"description": string | null,"expense_date": string,"id": string,"method": string,"notes": string | null,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "amount": number,"business_id": string,"category_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"expense_date": string,"id"?: string,"method"?: string,"notes"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"expense_date"?: string,"id"?: string,"method"?: string,"notes"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_business_id_category_id_fkey"
      columns: ["business_id","category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "expenses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "billing": string,"code": string,"created_at": string,"id": string,"is_active": boolean,"limits": NonNullable<Json>,"name": string,"price": number,"price_monthly": number,"updated_at": string
                  }
                  Insert: {
                    "billing"?: string,"code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name": string,"price"?: number,"price_monthly"?: number,"updated_at"?: string
                  }
                  Update: {
                    "billing"?: string,"code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"name"?: string,"price"?: number,"price_monthly"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admin_actions": {
                  Row: {
                    "action": string,"admin_email": string,"admin_user_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": string,"target_business_id": string | null,"target_business_name": string
                  }
                  Insert: {
                    "action": string,"admin_email": string,"admin_user_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_business_id"?: string | null,"target_business_name": string
                  }
                  Update: {
                    "action"?: string,"admin_email"?: string,"admin_user_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_business_id"?: string | null,"target_business_name"?: string
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
                },"purchase_items": {
                  Row: {
                    "business_id": string,"created_at": string,"description": string,"id": string,"line_total": number | null,"position": number,"purchase_id": string,"quantity": number,"unit_cost": number,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"description": string,"id"?: string,"line_total"?: never,"position": number,"purchase_id": string,"quantity": number,"unit_cost": number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"description"?: string,"id"?: string,"line_total"?: never,"position"?: number,"purchase_id"?: string,"quantity"?: number,"unit_cost"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_business_id_purchase_id_fkey"
      columns: ["business_id","purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "purchase_items_business_id_purchase_id_fkey"
      columns: ["business_id","purchase_id"]
isOneToOne: false
      referencedRelation: "purchases_overview"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"purchases": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"discount_amount": number,"due_date": string | null,"id": string,"notes": string | null,"purchase_date": string,"reference_no": string,"subtotal": number,"supplier_id": string | null,"total": number | null,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"discount_amount"?: number,"due_date"?: string | null,"id"?: string,"notes"?: string | null,"purchase_date": string,"reference_no": string,"subtotal"?: number,"supplier_id"?: string | null,"total"?: never,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"discount_amount"?: number,"due_date"?: string | null,"id"?: string,"notes"?: string | null,"purchase_date"?: string,"reference_no"?: string,"subtotal"?: number,"supplier_id"?: string | null,"total"?: never,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchases_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_business_id_supplier_id_fkey"
      columns: ["business_id","supplier_id"]
isOneToOne: false
      referencedRelation: "supplier_summary"
      referencedColumns: ["business_id","supplier_id"]
    },{
      foreignKeyName: "purchases_business_id_supplier_id_fkey"
      columns: ["business_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["business_id","id"]
    }
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
      referencedRelation: "customer_summary"
      referencedColumns: ["business_id","customer_id"]
    },{
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
                },"supplier_payments": {
                  Row: {
                    "amount": number,"business_id": string,"created_at": string,"created_by": string | null,"id": string,"method": string,"notes": string | null,"payment_date": string,"purchase_id": string,"reference": string | null,"supplier_id": string | null,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "amount": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method"?: string,"notes"?: string | null,"payment_date": string,"purchase_id": string,"reference"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method"?: string,"notes"?: string | null,"payment_date"?: string,"purchase_id"?: string,"reference"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_payments_business_id_purchase_id_fkey"
      columns: ["business_id","purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "supplier_payments_business_id_purchase_id_fkey"
      columns: ["business_id","purchase_id"]
isOneToOne: false
      referencedRelation: "purchases_overview"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "supplier_payments_business_id_supplier_id_fkey"
      columns: ["business_id","supplier_id"]
isOneToOne: false
      referencedRelation: "supplier_summary"
      referencedColumns: ["business_id","supplier_id"]
    },{
      foreignKeyName: "supplier_payments_business_id_supplier_id_fkey"
      columns: ["business_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["business_id","id"]
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
            "customer_summary": {
                  Row: {
                    "balance": number | null,"business_id": string | null,"customer_id": string | null,"name": string | null,"sale_count": number | null,"total_paid": number | null,"total_sales": number | null
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
                },"money_movements": {
                  Row: {
                    "amount": number | null,"business_id": string | null,"direction": string | null,"method": string | null,"movement_date": string | null,"source": string | null,"source_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"purchases_overview": {
                  Row: {
                    "amount_paid": number | null,"balance": number | null,"business_id": string | null,"created_at": string | null,"created_by": string | null,"discount_amount": number | null,"due_date": string | null,"due_status": string | null,"id": string | null,"notes": string | null,"payment_status": string | null,"purchase_date": string | null,"reference_no": string | null,"subtotal": number | null,"supplier_id": string | null,"supplier_name": string | null,"total": number | null,"void_reason": string | null,"voided_at": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchases_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_business_id_supplier_id_fkey"
      columns: ["business_id","supplier_id"]
isOneToOne: false
      referencedRelation: "supplier_summary"
      referencedColumns: ["business_id","supplier_id"]
    },{
      foreignKeyName: "purchases_business_id_supplier_id_fkey"
      columns: ["business_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"sales_overview": {
                  Row: {
                    "amount_paid": number | null,"balance": number | null,"business_id": string | null,"created_at": string | null,"created_by": string | null,"customer_id": string | null,"customer_name": string | null,"discount_amount": number | null,"due_date": string | null,"due_status": string | null,"id": string | null,"notes": string | null,"payment_status": string | null,"reference_no": string | null,"sale_date": string | null,"subtotal": number | null,"total": number | null,"void_reason": string | null,"voided_at": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customer_summary"
      referencedColumns: ["business_id","customer_id"]
    },{
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
                },"supplier_summary": {
                  Row: {
                    "balance": number | null,"business_id": string | null,"name": string | null,"purchase_count": number | null,"supplier_id": string | null,"total_paid": number | null,"total_purchases": number | null
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
                },"transactions_feed": {
                  Row: {
                    "amount": number | null,"business_id": string | null,"created_at": string | null,"created_by": string | null,"date": string | null,"description": string | null,"document_id": string | null,"due_status": string | null,"id": string | null,"method": string | null,"money_in": number | null,"money_out": number | null,"party_id": string | null,"party_name": string | null,"reference": string | null,"status": string | null,"type": string | null,"voided_at": string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_activate_plan":
{ Args: { "p_business_id": string,"p_note": string,"p_plan_code": string }; Returns: undefined
                           },
"admin_extend_trial":
{ Args: { "p_business_id": string,"p_days": number,"p_note": string }; Returns: undefined
                           },
"admin_list_actions":
{ Args: { "p_limit"?: number }; Returns: {
              "action": string,"admin_email": string,"business_id": string,"business_name": string,"created_at": string,"details": Json
            }[]
                           },
"admin_list_businesses":
{ Args: Record<PropertyKey, never>; Returns: {
              "access": string,"business_type": string,"created_at": string,"customers": number,"expenses": number,"id": string,"last_activity": string,"members": number,"name": string,"owner_email": string,"owner_name": string,"plan_code": string,"plan_name": string,"purchases": number,"sales": number,"status": string,"suppliers": number,"trial_ends_at": string
            }[]
                           },
"admin_set_business_status":
{ Args: { "p_business_id": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"create_business":
{ Args: { "p_address"?: string,"p_business_id": string,"p_business_type"?: string,"p_contact_number"?: string,"p_currency_code"?: string,"p_email"?: string,"p_name": string,"p_owner_name"?: string,"p_starting_cash_balance"?: string,"p_timezone"?: string }; Returns: string
                           },
"create_cash_adjustment":
{ Args: { "p_business_id": string,"p_entry": Json }; Returns: string
                           },
"create_expense":
{ Args: { "p_business_id": string,"p_expense": Json }; Returns: string
                           },
"create_purchase":
{ Args: { "p_business_id": string,"p_purchase": Json }; Returns: string
                           },
"create_sale":
{ Args: { "p_business_id": string,"p_sale": Json }; Returns: string
                           },
"get_activity":
{ Args: { "p_before"?: string,"p_before_id"?: string,"p_business_id": string,"p_limit"?: number,"p_table"?: string }; Returns: {
              "action": string,"actor_name": string,"amount": string,"changes": Json,"created_at": string,"id": string,"label": string,"parent_id": string,"reason": string,"record_id": string,"table_name": string
            }[]
                           },
"get_amount_to_collect":
{ Args: { "p_business_id": string,"p_customer_id"?: string }; Returns: string
                           },
"get_amount_to_pay":
{ Args: { "p_business_id": string,"p_supplier_id"?: string }; Returns: string
                           },
"get_daily_series":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "day": string,"sales": string
            }[]
                           },
"get_dashboard":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"get_money_by_method":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "method": string,"money_in": string,"money_out": string,"net": string
            }[]
                           },
"get_monthly_series":
{ Args: { "p_business_id": string,"p_end"?: string,"p_months"?: number }; Returns: {
              "expenses": string,"month": string,"profit": string,"purchases": string,"sales": string
            }[]
                           },
"get_my_access":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"has_money_records":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"record_customer_payment":
{ Args: { "p_business_id": string,"p_payment": Json }; Returns: string
                           },
"record_supplier_payment":
{ Args: { "p_business_id": string,"p_payment": Json }; Returns: string
                           },
"report_business":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "address": string | null,
"business_type": string | null,
"contact_number": string | null,
"created_at": string,
"created_by": string | null,
"currency_code": string,
"email": string | null,
"id": string,
"logo_path": string | null,
"name": string,
"owner_name": string | null,
"starting_balance_date": string,
"starting_cash_balance": number,
"status": string,
"timezone": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "businesses"
        isOneToOne: true
        isSetofReturn: false
      } },
"report_cash_flow":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_expenses":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_payment_methods":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_profit_loss":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_purchases":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_purchases_by_supplier":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_sales":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_sales_by_customer":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_to_collect":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"report_to_pay":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"update_business_settings":
{ Args: { "p_address": string,"p_business_id": string,"p_business_type": string,"p_contact_number": string,"p_currency_code": string,"p_email": string,"p_name": string,"p_owner_name": string,"p_starting_balance_date": string,"p_starting_cash_balance": string }; Returns: undefined
                           },
"update_cash_adjustment":
{ Args: { "p_business_id": string,"p_entry": Json }; Returns: undefined
                           },
"update_expense":
{ Args: { "p_business_id": string,"p_expense": Json }; Returns: undefined
                           },
"update_purchase":
{ Args: { "p_business_id": string,"p_purchase": Json }; Returns: undefined
                           },
"update_sale":
{ Args: { "p_business_id": string,"p_sale": Json }; Returns: undefined
                           },
"void_cash_adjustment":
{ Args: { "p_business_id": string,"p_entry_id": string,"p_reason": string }; Returns: undefined
                           },
"void_customer_payment":
{ Args: { "p_business_id": string,"p_payment_id": string,"p_reason": string }; Returns: undefined
                           },
"void_expense":
{ Args: { "p_business_id": string,"p_expense_id": string,"p_reason": string }; Returns: undefined
                           },
"void_purchase":
{ Args: { "p_business_id": string,"p_purchase_id": string,"p_reason": string }; Returns: undefined
                           },
"void_sale":
{ Args: { "p_business_id": string,"p_reason": string,"p_sale_id": string }; Returns: undefined
                           },
"void_supplier_payment":
{ Args: { "p_business_id": string,"p_payment_id": string,"p_reason": string }; Returns: undefined
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
