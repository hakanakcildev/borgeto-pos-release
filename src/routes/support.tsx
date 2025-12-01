import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { POSLayout } from "@/components/layouts/POSLayout";

export const Route = createFileRoute("/support")({
  component: Support,
});

function Support() {
  return (
    <POSLayout>
      <SupportContent />
    </POSLayout>
  );
}

function SupportContent() {
  const phoneNumber = "05308627537";
  const whatsappNumber = "05308627537";
  const email = "info@borgeto.com";

  const handlePhoneClick = () => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleWhatsAppClick = () => {
    window.open(`https://wa.me/${whatsappNumber.replace(/^0/, "90")}`, "_blank");
  };

  const handleEmailClick = () => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 p-3 lg:p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Phone className="h-8 w-8" />
          Destek
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          Bize ulaşmak için aşağıdaki iletişim bilgilerini kullanabilirsiniz
        </p>
      </div>
      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Telefon */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2">
              <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              Telefon
            </h3>
            <a
              href={`tel:${phoneNumber}`}
              onClick={handlePhoneClick}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm mb-2 transition-colors"
            >
              {phoneNumber}
            </a>
            <div className="w-full flex flex-col items-center">
              <div className="bg-white dark:bg-white p-2 rounded-lg">
                <QRCodeSVG
                  value={`tel:${phoneNumber}`}
                  size={120}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
              <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              WhatsApp
            </h3>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/^0/, "90")}`}
              onClick={handleWhatsAppClick}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium text-sm mb-2 transition-colors"
            >
              {whatsappNumber}
            </a>
            <div className="w-full flex flex-col items-center">
              <div className="bg-white dark:bg-white p-2 rounded-lg">
                <QRCodeSVG
                  value={`https://wa.me/${whatsappNumber.replace(/^0/, "90")}`}
                  size={120}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* E-posta */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-2">
              <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              E-posta
            </h3>
            <a
              href={`mailto:${email}`}
              onClick={handleEmailClick}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium text-sm mb-2 transition-colors break-all"
            >
              {email}
            </a>
            <div className="w-full flex flex-col items-center">
              <div className="bg-white dark:bg-white p-2 rounded-lg">
                <QRCodeSVG
                  value={`mailto:${email}`}
                  size={120}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

