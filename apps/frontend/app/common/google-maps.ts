export type Place = {
  url: string;
  location: google.maps.LatLngLiteral;
};

export class PlaceResolver {
  private placesService: google.maps.places.PlacesService;

  constructor(placesLibrary: google.maps.PlacesLibrary) {
    this.placesService = new placesLibrary.PlacesService(
      document.createElement("div"),
    );
  }

  async resolvePlace(query: string): Promise<Place> {
    const placeResult = await this.findPlaceFromQuery(query);
    if (!placeResult.place_id) {
      throw new Error("Place result does not have a place_id");
    }
    if (!placeResult.geometry?.location) {
      throw new Error("Place result does not have a location");
    }

    const placeDetails = await this.getPlaceDetails(placeResult.place_id);
    if (!placeDetails.url) throw new Error("Place details do not have a URL");

    return {
      url: placeDetails.url,
      location: {
        lat: placeResult.geometry.location.lat(),
        lng: placeResult.geometry.location.lng(),
      },
    };
  }

  private async findPlaceFromQuery(query: string) {
    return new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
      this.placesService.findPlaceFromQuery(
        {
          fields: ["geometry.location", "place_id"],
          query: query,
        },
        (results) => {
          if (!results?.length) {
            reject(new Error("No results found"));
          } else {
            resolve(results[0]);
          }
        },
      );
    });
  }

  private async getPlaceDetails(placeId: string) {
    return new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
      this.placesService.getDetails(
        { placeId: placeId, fields: ["url"] },
        (result) => {
          if (!result) {
            reject(new Error("No details found"));
          } else {
            resolve(result);
          }
        },
      );
    });
  }
}
