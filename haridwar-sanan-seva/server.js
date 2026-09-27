require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env");
    process.exit(1);
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/create-order", async (req, res) => {
    try {
        const { name, mobile, email, date, persons, amount } = req.body;
        if (!name || !mobile || !email || !date || !Number(persons) || !Number(amount)) {
            return res.status(400).json({ error: "Missing booking details." });
        }
        const expectedAmount = Number(persons) * 31;
        if (Number(amount) !== expectedAmount) {
            return res.status(400).json({ error: "Invalid booking amount." });
        }
        const order = await razorpay.orders.create({
            amount: expectedAmount * 100,
            currency: "INR",
            receipt: `hss_${Date.now()}`,
            notes: { customer_name: String(name).slice(0, 100), booking_date: date, persons: String(persons) }
        });
        res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not create Razorpay order." });
    }
});

app.post("/api/verify-payment", (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking) {
            return res.status(400).json({ error: "Incomplete payment response." });
        }
        const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
        if (expectedSignature.length !== razorpay_signature.length ||
            !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature))) {
            return res.status(400).json({ error: "Invalid payment signature." });
        }
        const bookingId = `HSS-${Math.floor(10000 + Math.random() * 90000)}`;
        res.json({
            success: true,
            booking: {
                bookingId,
                name: booking.name,
                mobile: booking.mobile,
                email: booking.email,
                date: booking.date,
                persons: Number(booking.persons),
                amount: Number(booking.amount),
                paymentStatus: "PAID",
                bookingStatus: "CONFIRMED",
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                createdAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Payment verification failed." });
    }
});

app.listen(PORT, () => console.log(`Haridwar Sanan Seva running at http://localhost:${PORT}`));
