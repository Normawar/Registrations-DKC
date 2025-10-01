
import { LucideIcon, User, Receipt, History, Code, FileQuestion, Crown, PersonStanding, Castle, VenetianMask, Church } from "lucide-react";

export type HelpTopic = {
  id: string;
  title: string;
  keywords: string[];
  icon: LucideIcon;
  content: string;
};

export const helpTopics: HelpTopic[] = [
  {
    id: "profile",
    title: "Managing Your Profile",
    icon: User,
    keywords: ["profile", "avatar", "password", "name", "email", "school", "district"],
    content: `
      ## Your Profile
      The Profile page is where you manage all your personal and account information.

      ### Personal Information
      - You can update your first name, last name, and contact phone number.
      - Your email address is tied to your account and cannot be changed.

      ### School & District
      - For Sponsors, your school and district affiliation is critical. You can change this using the dropdown menus.
      - **Important**: Changing your school or district will change which roster you have access to.

      ### Profile Picture
      - You can either upload a custom photo or choose one of the chess piece icons as your avatar.
      - **To upload a photo:** Select the "Upload Photo" tab, click "Choose File", and select an image from your device.
      - **To choose an icon:** Select the "Choose Icon" tab and click on your desired chess piece.
      - Click **Save Picture** to apply your changes.

      ### Changing Your Password
      - To change your password, you must enter your current password, followed by your new password twice for confirmation.
      - The new password must be at least 8 characters long.
    `
  },
  {
    id: "dashboard",
    title: "Using Your Dashboard",
    icon: Crown,
    keywords: ["dashboard", "overview", "calendar", "roster", "activity"],
    content: `
      ## The Dashboard
      Your Dashboard provides a quick overview of important information.

      ### Event Calendar
      - This calendar highlights dates with upcoming tournaments.
      - Click on a highlighted date to see the events scheduled for that day.
      - You can register for an event directly from the event details card that appears below the calendar.

      ### My Roster / My Students
      - This card gives you a quick look at the players associated with your account.
      - For **Sponsors**, this is your school's team roster.
      - For **Individuals**, this is the list of students you have added to your profile.
      - Click the "View & Manage" button to go to the full Roster page for more options.

      ### Recent Activity
      - This table shows your most recent registrations and their associated invoice status.
    `
  },
  {
    id: "roster",
    title: "Managing Your Roster",
    icon: PersonStanding,
    keywords: ["roster", "players", "add student", "remove student", "team code"],
    content: `
      ## The Roster Page
      This is the most important page for sponsors to manage before registering for an event.

      ### Adding a Player
      1. Click the **Add from Database** button.
      2. In the search dialog, enter the player's name or USCF ID. The system will search the master database of all players.
      3. From the search results, find the correct player and click **Select** or **Add & Complete**.
      4. A dialog will appear, pre-filled with the player's information. You **must** fill in any missing required fields, such as Grade, Section, Email, and Zip Code.
      5. Click **Save Player**. The student is now on your school's roster.

      ### Creating a New Player
      - If a player cannot be found in the master database, you can create a new record by clicking **Create New Player**.
      - Fill out all the required information. For USCF ID, you can enter "NEW" if they do not have one.

      ### Editing a Player
      - Click the three-dot menu on a player's row and select **Edit**.
      - Update their information in the dialog that appears. This is useful for updating a player's grade or section at the start of a new school year.

      ### Removing a Player from Your Roster
      - Click the three-dot menu on a player's row and select **Remove from Roster**.
      - This only removes the association with your school; it does not delete the player from the master database.
    `
  },
  {
    id: "register-for-event",
    title: "Registering for an Event",
    icon: Castle,
    keywords: ["register", "event", "tournament", "selection", "charges", "invoice"],
    content: `
      ## Registering for an Event
      You can register players for a tournament from the Dashboard or the "Register for Event" page.

      1. Find the event you want to register for and click the **Register Students** or **Register** button.
      2. A dialog will appear listing all players on your roster (for Sponsors) or your students (for Individuals).
      3. Select the players you wish to register by clicking on their card or the "Select" button.
      4. For each selected player, you must confirm their **Section** and their **USCF Status**. If a player needs a new or renewed membership, select the appropriate option to add the USCF fee to the invoice.
      5. Once you have selected all your players, click **Review Charges**.
      6. A confirmation screen will show a breakdown of all fees (Registration, Late Fees, USCF Fees).
      7. Click **Create Invoice** to finalize the registration. An invoice will be generated and you will be taken to the Invoices page to complete payment.
    `
  },
  {
    id: "invoices-payments",
    title: "Invoices & Payments",
    icon: Receipt,
    keywords: ["invoice", "payment", "square", "credit card", "po", "check", "cashapp", "zelle"],
    content: `
      ## Invoices & Payments
      This page lists all your past and present invoices.

      ### Viewing an Invoice
      - Click the **Details** button on any invoice row to open the details dialog.
      - Here you can see a list of registered players, the total amount, and the payment status.

      ### Paying an Invoice
      There are two main ways to pay an invoice:

      1.  **Online with Credit Card (via Square):**
          - In the invoice details, click the **View Invoice on Square** button.
          - This will open a secure Square page where you can pay with a credit card.
          - Payments made through Square are automatically synced and will update the invoice status to "Paid".

      2.  **Offline Payment (PO, Check, etc.):**
          - In the invoice details, select your payment method (e.g., Purchase Order, Check).
          - Fill in the required information (like PO number or check number).
          - Upload a proof of payment document (e.g., a copy of the PO, a photo of the check).
          - Click **Submit Payment Information**. This sends your proof to an organizer for manual verification and approval. The invoice status will be updated once the payment is confirmed.
    `
  },
  {
    id: "change-requests",
    title: "Making a Change Request",
    icon: VenetianMask,
    keywords: ["change request", "withdraw", "substitute", "section change", "bye"],
    content: `
      ## Change Requests
      If you need to make a change to a registration after an invoice has been created, you must submit a Change Request for an organizer to approve.

      1.  Navigate to the **Change Requests** page.
      2.  Click the **Make A Change Request** button.
      3.  In the dialog, first select the event registration you wish to modify from the dropdown.
      4.  Choose the **Request Type** (e.g., Withdrawal, Substitution).
      5.  Fill in the specific details for your request. For a substitution, you will need to select the player to remove and the player to add from your roster.
      6.  Add any additional notes for the organizer.
      7.  Click **Submit Request**.

      Your request will appear in the list with a "Pending" status. An organizer will review it and either approve or deny it.
    `
  },
  {
    id: "uscf-membership",
    title: "Purchasing USCF Membership ONLY",
    icon: Church,
    keywords: ["uscf", "membership", "assistant", "purchase"],
    content: `
      ## USCF Membership
      This page is for purchasing or renewing a USCF membership **without** registering for a tournament.

      ### AI Membership Assistant
      - If you are unsure which membership type a player needs, use the AI Assistant.
      - Enter the player's Date of Birth and answer whether they have played in a rated tournament before.
      - The AI will suggest the most appropriate membership type (e.g., Youth, Young Adult) and provide a justification.

      ### Purchasing the Membership
      - After getting a suggestion, click the **Purchase This Membership** button.
      - On the purchase page, you can add one or more players to the invoice.
      - Fill in the required details for each player.
      - Click **Create Invoice** to finalize the purchase. You will then be directed to the Invoices page to handle payment.
    `
  },
  {
    id: "team-codes",
    title: "Team Code Directory",
    icon: Code,
    keywords: ["team code", "school code", "directory", "search"],
    content: `
      ## Team Code Directory
      This page provides a searchable directory of all schools and their official team codes.

      - Use the search bar to find a school by its name, district, or team code.
      - You can also filter the list by district using the dropdown menu.
      - This is useful for verifying team codes or finding codes for schools outside your own district.
    `
  },
  {
    id: "previous-events",
    title: "Viewing Previous Events",
    icon: History,
    keywords: ["previous events", "past tournaments", "history", "archive"],
    content: `
      ## Previous Events
      This page provides an archive of all past tournaments.

      - You can see the event name, date, and location.
      - If you had a registration for a past event, you can click **View Invoice** to see the details of that transaction.
      - Any flyers or images associated with the event will also be available for download.
    `
  },
];
