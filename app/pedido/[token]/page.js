import TrackingClient from "./TrackingClient";

export default async function DeliveryTrackingPage({ params }) {
  const { token } = await params;
  return <TrackingClient token={token} />;
}

