import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import { useI18n } from '../i18n/I18nContext';

// Customer side of a one-to-one conversation with a shop.
export default function CustomerChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <ChatWindow
      basePath="/api/customer"
      conversationId={conversationId}
      myRole="customer"
      accent="#4f46e5"
      deriveHeader={(c) => ({
        title: c.shop_name || '',
        subtitle: c.shop_status && c.shop_status !== 'active'
          ? t('chatUnavailableShop')
          : (c.shop_category || t('merchantLabel')),
      })}
      onBack={() => navigate('/customer/messages')}
    />
  );
}
