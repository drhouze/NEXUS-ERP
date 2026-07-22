import { getCurrentUser } from '@/lib/session'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { GenericDocument, GenericDocTemplateConfig } from '@/components/erp/generic-document'
import { getDefaultConfig } from '@/app/api/erp/document-templates/route'

function parseConfig(v: any): Record<string, any> {
  if (!v) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return {} }
}

export default async function POPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: true } },
      tenant: true,
    },
  })

  if (!po) return <div>PO not found</div>
  if (user.role !== 'OWNER' && po.tenantId !== user.tenantId) return <div>Access denied</div>

  // ---- Load purchase_order document template (auto-create with defaults if missing) ----
  let tpl = await db.documentTemplate.findUnique({
    where: { tenantId_docType: { tenantId: po.tenantId, docType: 'purchase_order' } },
  })
  if (!tpl) {
    tpl = await db.documentTemplate.create({
      data: {
        tenantId: po.tenantId,
        docType: 'purchase_order',
        config: JSON.stringify(getDefaultConfig('purchase_order')),
      },
    })
  }
  const config = parseConfig(tpl.config)
  const template: GenericDocTemplateConfig = {
    businessName: config.businessName || po.tenant.name,
    docLabel: config.docLabel || 'PURCHASE ORDER',
    phone: config.phone || '',
    address: config.address || '',
    primaryColor: config.primaryColor || '#263373',
    fontSize: config.fontSize || '12px',
    colItem: config.colItem,
    colQty: config.colQty,
    colPrice: config.colPrice,
    colAmount: config.colAmount,
    colSku: config.colSku,
    showBankDetails: config.showBankDetails,
    bankName: config.bankName,
    bankAccount: config.bankAccount,
    bankAccountName: config.bankAccountName,
    paymentInstructions: config.paymentInstructions,
    showPaymentQR: config.showPaymentQR,
    showTerms: config.showTerms,
    termsText: config.termsText,
    showSignature: config.showSignature,
    signatureLabel1: config.signatureLabel1,
    signatureLabel2: config.signatureLabel2,
    footerText: config.footerText,
    currencySymbol: config.currencySymbol,
  }

  return (
    <GenericDocument
      docType="purchase_order"
      template={template}
      tenant={po.tenant}
      po={po}
      showBack
    />
  )
}
