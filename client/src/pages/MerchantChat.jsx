import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import { useI18n } from '../i18n/I18nContext';

// Merchant side of a one-to-one conversation with a customer.
export default function MerchantChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <ChatWindow
      basePath="/api/merchant"
      conversationId={conversationId}
      myRole="shop"
      accent="#059669"
      deriveHeader={(c) => ({
        title: c.customer_name || t('customerLabel'),
        subtitle: t('customerLabel'),
      })}
      onBack={() => navigate('/shop/messages')}
    />
  );
}
