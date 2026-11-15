FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends g++ curl unzip \
    && rm -rf /var/lib/apt/lists/*
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
COPY src/ src/
COPY path_engine/ path_engine/
RUN chmod +x mvnw && sh path_engine/build-native.sh \
    && ./mvnw -B -ntp clean package

# Use the same Ubuntu release as the compiler stage for JNI compatibility.
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/demo-0.0.1-SNAPSHOT.jar /app/app.jar
USER 10001:10001
EXPOSE 18080
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD curl -fsS http://127.0.0.1:18080/api/navigation/status | grep -q '"available":true'
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
