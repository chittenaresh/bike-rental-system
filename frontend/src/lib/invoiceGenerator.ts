import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Rental, Bike, User } from '@/types';

// Define extended type for jsPDF to include autoTable
interface jsPDFCustom extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

export const generateInvoice = (rental: any, currentUser?: any) => {
  const doc = new jsPDF() as jsPDFCustom;
  const bike = rental.bike || (typeof rental.bikeId === 'object' ? rental.bikeId : null);
  const user =
    rental.user || (typeof rental.userId === 'object' ? rental.userId : null) || currentUser;

  // Constants
  const companyName = 'RideFlow Bike Rentals';
  const companyAddress = bike?.location
    ? `${bike.location.city}, ${bike.location.state}`
    : 'RideFlow HQ';
  const invoiceDate = format(new Date(), 'dd/MM/yyyy');
  const rentalId = rental.id.slice(-6).toUpperCase();

  // Colors
  const primaryColor = [255, 87, 34]; // Orange #FF5722

  // Header
  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('INVOICE', 14, 20);

  // Company Info
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(companyName, 14, 30);
  doc.text(companyAddress, 14, 35);
  doc.text('info@bikerental.com', 14, 40);

  // Invoice Details
  doc.setFontSize(10);
  doc.setTextColor(0);
  const rightMargin = 196;
  doc.text(`Invoice #: ${rentalId}`, rightMargin, 30, { align: 'right' });
  doc.text(`Date: ${invoiceDate}`, rightMargin, 35, { align: 'right' });
  doc.text(`Status: ${rental.paymentStatus || 'PAID'}`, rightMargin, 40, { align: 'right' });

  // Bill To
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Bill To:', 14, 55);
  doc.setFontSize(10);
  doc.setTextColor(0);
  if (user) {
    doc.text(user.name || 'Guest', 14, 62);
    doc.text(user.email || '', 14, 67);
  } else {
    doc.text('Customer', 14, 62);
  }

  // Rental Details Section
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Rental Details', 14, 80);

  const pickupTime = rental.pickupTime ? format(new Date(rental.pickupTime), 'PP p') : '-';
  const dropoffTime = rental.dropoffTime ? format(new Date(rental.dropoffTime), 'PP p') : '-';

  autoTable(doc, {
    startY: 85,
    head: [['Bike', 'Pickup Time', 'Dropoff Time', 'Duration']],
    body: [
      [
        bike ? `${bike.brand || ''} ${bike.name}` : 'Bike',
        pickupTime,
        dropoffTime,
        calculateDuration(rental.pickupTime, rental.dropoffTime),
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [255, 87, 34] },
  });

  // Calculate Costs (Logic reused from Dashboard)
  const bookingPrice = rental.totalAmount || 0;
  const totalCost = rental.totalCost || 0;
  const extras = totalCost > bookingPrice ? totalCost - bookingPrice : 0;

  const startKm = parseFloat(rental.startKm || '0');
  const endKm = parseFloat(rental.endKm || '0');

  let distancePrice = 0;
  let excessKm = 0;

  if (!isNaN(startKm) && !isNaN(endKm) && bike && bike.excessKmCharge && bike.kmLimit) {
    const totalKm = Math.max(0, endKm - startKm);
    const kmLimit = Number(bike.kmLimit);
    excessKm = Math.max(0, totalKm - kmLimit);
    distancePrice = excessKm * Number(bike.excessKmCharge);
  }

  // Delay stored in backend as minutes; convert to hours to match admin
  const hourlyRate = Number(bike?.weekdayRate || bike?.pricePerHour || 0);
  const delayMinutesRaw = parseFloat(rental.delay || '0');
  let delayPrice = 0;
  let delayHours = '0';
  if (!isNaN(delayMinutesRaw) && delayMinutesRaw > 0 && hourlyRate > 0) {
    const hours = delayMinutesRaw / 60;
    delayPrice = hours * hourlyRate;
    delayHours = hours.toFixed(2);
  }

  // Charges Breakdown
  const startY = doc.lastAutoTable.finalY + 15;

  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Charges Breakdown', 14, startY);

  const chargesData = [['Base Booking Amount', `Rs. ${bookingPrice.toFixed(2)}`]];

  if (distancePrice > 0) {
    chargesData.push([
      `Excess Distance (${excessKm.toFixed(1)} km x Rs. ${bike?.excessKmCharge}/km)`,
      `Rs. ${distancePrice.toFixed(2)}`,
    ]);
  }

  if (delayPrice > 0) {
    chargesData.push([
      `Delay Charges (${delayHours} hrs x Rs. ${hourlyRate}/hr)`,
      `Rs. ${delayPrice.toFixed(2)}`,
    ]);
  }

  // Total
  chargesData.push(['Total Amount Paid', `Rs. ${totalCost.toFixed(2)}`]);

  autoTable(doc, {
    startY: startY + 5,
    head: [['Description', 'Amount']],
    body: chargesData,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60] }, // Dark grey for charges
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.row.index === chargesData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Thank you for choosing RideFlow!', 14, pageHeight - 20);
  doc.text('For any queries, contact info@bikerental.com', 14, pageHeight - 15);

  // Save PDF
  doc.save(`Invoice_${rentalId}.pdf`);
};

function calculateDuration(start: string, end?: string): string {
  if (!start || !end) return '-';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHrs}h ${diffMins}m`;
}
