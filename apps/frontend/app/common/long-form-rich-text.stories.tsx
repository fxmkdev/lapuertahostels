import { Meta, StoryObj } from "@storybook/react";
import {
  bold,
  heading,
  internalLink,
  list,
  richTextRoot,
  paragraph,
  text,
  listitem,
} from "@lapuertahostels/rich-text";
import { LongFormRichText } from "./long-form-rich-text";

const meta = {
  title: "common/LongFormRichText",
  component: LongFormRichText,
} satisfies Meta<typeof LongFormRichText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    baseHeadingLevel: 3,
    content: richTextRoot(
      paragraph(
        text(
          "Thank you for choosing La Puerta Hostels. These Terms and Conditions outline the rules and regulations for using our website, booking services, and staying at our property. By accessing this website and making a reservation, you agree to be bound by the following terms. Please read them carefully.",
        ),
      ),
      heading("h4", text("1. Reservations")),
      paragraph(
        text(
          "All bookings made through our website or directly with the hotel are subject to room availability and confirmation. Once a reservation is confirmed, an email confirmation will be sent to you containing your booking details. The room rates are quoted in Colombian Pesos and include applicable taxes unless otherwise stated.",
        ),
      ),
      heading("h4", text("2. Check-In and Check-Out")),
      list(
        "ul",
        listitem(text("Check-in time: "), bold("4.00 p.m.")),
        listitem(
          text("Check-out time: "),
          bold("11.00 a.m."),
          text(
            " Late check-out requests are subject to availability and may incur additional charges.",
          ),
        ),
      ),
      heading("h4", text("3. Payment")),
      paragraph(
        text(
          "A valid credit card is required to guarantee your booking. Payment methods accepted include [credit card types], bank transfers, and cash on arrival. The hotel reserves the right to pre-authorize your credit card prior to your arrival.",
        ),
      ),
      heading("h4", text("4. Changes to Your Reservation")),
      paragraph(
        text(
          "If you need to modify your reservation, please contact us at least [number of hours/days] before your scheduled check-in time. Changes are subject to availability, and price adjustments may apply.",
        ),
      ),
      heading("h4", text("5. Cancellation and No-Show")),
      paragraph(
        text(
          "For all cancellation policies, including fees and deadlines, please refer to our ",
        ),
        internalLink("/cancellation", text("Cancellation Policy")),
        text(
          " page. Failure to cancel your booking within the allowed time or not showing up will result in charges as outlined in the Cancellation Policy.",
        ),
      ),
      heading("h4", text("6. Room Policies")),
      paragraph(text("The maximum number of guests per room is [number].")),
      paragraph(
        1,
        text(
          "Smoking is [allowed/not allowed] in all guest rooms and public areas. Designated smoking areas are available [if applicable].",
        ),
      ),
      paragraph(
        text(
          "Pets are [allowed/not allowed]. If pets are allowed, additional fees and rules may apply.",
        ),
      ),
      paragraph(text("")),
      paragraph(
        text(
          "Guests are responsible for any damage caused to hotel property during their stay. Repair or replacement costs will be charged to the guest’s account.",
        ),
      ),
      heading("h4", text("7. Liability")),
      paragraph(
        text(
          "[Hotel Name] is not responsible for any loss or damage to personal belongings left in guest rooms or public areas. We recommend using the in-room safe provided for valuables. Additionally, the hotel is not liable for any injuries, damages, or accidents occurring on the property unless caused by negligence on the part of the hotel.",
        ),
      ),
      heading("h4", text("8. Use of the Website")),
      paragraph(text("By using this website, you agree that:")),
      list(
        "ul",
        listitem(
          text(
            "All information provided during the booking process is accurate and complete.",
          ),
        ),
        listitem(
          text(
            "You will not engage in any activities that may harm the website, impair its functionality, or interfere with other users.",
          ),
        ),
        listitem(
          text(
            "You are responsible for maintaining the confidentiality of your booking and payment details.",
          ),
        ),
      ),
      heading("h4", text("9. Privacy")),
      paragraph(
        text(
          "We take your privacy seriously. For more information on how we handle your personal data, please see our ",
        ),
        internalLink("/privacy", text("Privacy Policy")),
        text("."),
      ),
      heading("h4", text("10. Governing Law")),
      paragraph(
        text(
          "These terms and conditions are governed by the laws of [country/state], and any disputes arising will be resolved in accordance with these laws.",
        ),
      ),
      heading("h4", text("11. Amendments")),
      paragraph(
        text(
          "La Puerta Hostels reserves the right to update or modify these Terms and Conditions at any time. Guests are encouraged to review the terms regularly to stay informed of any changes.",
        ),
      ),
    ),
  },
};
