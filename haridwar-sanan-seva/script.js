const pricePerPerson = 31;
const RAZORPAY_KEY_ID = "rzp_live_Th3282LsPF2RIG";

const personsSelect = document.getElementById("persons");
const totalAmount = document.getElementById("totalAmount");
const freeParking = document.getElementById("freeParking");
const bookingForm = document.getElementById("bookingForm");
const dateInput = document.getElementById("date");

function updateBookingAmount() {
    const persons = Number(personsSelect.value);
    if (!persons) {
        totalAmount.textContent = "₹0";
        freeParking.style.display = "none";
        return;
    }
    totalAmount.textContent = "₹" + (persons * pricePerPerson);
    freeParking.style.display = persons >= 4 ? "block" : "none";
}

personsSelect.addEventListener("change", updateBookingAmount);

if (dateInput) {
    const today = new Date();
    dateInput.min = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
}

function getBookingDetails() {
    const name = document.getElementById("name").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const email = document.getElementById("email").value.trim();
    const date = document.getElementById("date").value;
    const persons = Number(personsSelect.value);

    if (!name || !mobile || !email || !date || !persons) {
        throw new Error("Please fill all booking details.");
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        throw new Error("Please enter a valid 10 digit mobile number.");
    }
    return { name, mobile, email, date, persons, amount: persons * pricePerPerson };
}

bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    let booking;
    try {
        booking = getBookingDetails();
    } catch (error) {
        alert(error.message);
        return;
    }

    const button = bookingForm.querySelector("button[type='submit']");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Creating Payment...";

    try {
        const orderResponse = await fetch("/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(booking)
        });
        const orderData = await orderResponse.json();
        if (!orderResponse.ok) throw new Error(orderData.error || "Unable to create payment order.");

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "Haridwar Sanan Seva",
            description: `Sanan Seva Booking - ${booking.persons} Person(s)`,
            order_id: orderData.orderId,
            prefill: { name: booking.name, email: booking.email, contact: booking.mobile },
            notes: { booking_date: booking.date, persons: String(booking.persons) },
            handler: async (response) => verifyPayment(response, booking),
            modal: {
                ondismiss: () => {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.on("payment.failed", (response) => {
            alert("Payment failed.\n\n" + (response.error?.description || "Please try again."));
            button.disabled = false;
            button.textContent = originalText;
        });
        razorpay.open();
    } catch (error) {
        alert(error.message || "Something went wrong.");
        button.disabled = false;
        button.textContent = originalText;
    }
});

async function verifyPayment(paymentResponse, booking) {
    try {
        const response = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...paymentResponse, booking })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Payment verification failed.");

        localStorage.setItem("haridwarBooking", JSON.stringify(result.booking));
        window.location.href = "/booking-success.html";
    } catch (error) {
        alert(error.message || "Payment verification failed.");
    }
}
